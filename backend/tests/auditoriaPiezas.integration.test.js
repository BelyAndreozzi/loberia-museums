const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');
const ejecutar = promisify(execFile);
const controlar = (binario, args) => new Promise((resolve, reject) => {
    const child = spawn(binario, args, { windowsHide: true, stdio: 'ignore' });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`pg_ctl falló: ${code}`)));
});

test('auditoría de piezas en PostgreSQL aislado', { skip: !process.env.PG_BIN, timeout: 120000 }, async t => {
    const carpeta = await fs.mkdtemp(path.join(os.tmpdir(), 'museos-auditoria-'));
    const data = path.join(carpeta, 'data');
    const bin = nombre => path.join(process.env.PG_BIN, `${nombre}${process.platform === 'win32' ? '.exe' : ''}`);
    const libre = net.createServer();
    await new Promise(resolve => libre.listen(0, '127.0.0.1', resolve));
    const puerto = libre.address().port;
    await new Promise(resolve => libre.close(resolve));
    await ejecutar(bin('initdb'), ['-D', data, '-U', 'auditoria_test', '--auth=trust', '--encoding=UTF8', '--locale=C'], { windowsHide: true });
    await controlar(bin('pg_ctl'), ['-D', data, '-l', path.join(carpeta, 'postgres.log'), '-o', `-p ${puerto} -h 127.0.0.1`, '-w', 'start']);
    let pool;
    let server;
    t.after(async () => {
        if (server) await new Promise(resolve => server.close(resolve));
        if (pool) await pool.end();
        await controlar(bin('pg_ctl'), ['-D', data, '-m', 'fast', '-w', 'stop']);
    });
    Object.assign(process.env, {
        DB_HOST: '127.0.0.1', DB_PORT: String(puerto), DB_USER: 'auditoria_test', DB_PASSWORD: '', DB_NAME: 'postgres',
        JWT_SECRET: crypto.randomBytes(48).toString('hex'), FRONTEND_URL: 'http://localhost:5173', NODE_ENV: 'test',
    });
    pool = require('../db');
    const bcrypt = require('bcrypt');

    // Instalación desde cero: esquema base + migraciones.
    await pool.query(await fs.readFile(path.join(__dirname, '../schema.sql'), 'utf8'));
    await ejecutar(process.execPath, [path.join(__dirname, '../scripts/migrate.js')], { windowsHide: true, env: process.env });
    const password = 'Segura123';
    const hash = await bcrypt.hash(password, 4);
    await pool.query(`INSERT INTO usuarios (username, email, password_hash, rol, museo_id, email_verificado, estado_aprobacion)
        VALUES ('naturales', 'naturales@example.com', $1, 'encargado', 1, TRUE, 'aprobado'),
               ('historia', 'historia@example.com', $1, 'encargado', 2, TRUE, 'aprobado')`, [hash]);

    const app = require('../index');
    server = await new Promise(resolve => {
        const servidor = app.listen(0, '127.0.0.1', () => resolve(servidor));
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    const iniciarSesion = async (email, museo_id) => {
        const respuesta = await fetch(`${base}/api/auth/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, museo_id }),
        });
        assert.equal(respuesta.status, 200);
        return respuesta.headers.getSetCookie().map(valor => valor.split(';')[0]).join('; ');
    };
    const sesionNaturales = await iniciarSesion('naturales@example.com', 1);
    const sesionHistoria = await iniciarSesion('historia@example.com', 2);
    const api = (Cookie, metodo, ruta, body) => fetch(`${base}/api/piezas${ruta}`, {
        method: metodo, headers: { Cookie, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body),
    });
    const auditoria = async piezaId => (await pool.query(
        'SELECT pieza_id, museo_id, usuario_id, accion, detalles FROM auditoria_piezas WHERE pieza_id = $1 ORDER BY id', [piezaId]
    )).rows;
    const crear = async (Cookie, datos) => {
        const respuesta = await api(Cookie, 'POST', '', datos);
        assert.equal(respuesta.status, 201);
        return (await respuesta.json()).pieza_id;
    };

    let piezaId;
    await t.test('CREAR: registra autor tomado de la sesión, ignorando usuario_id del body', async () => {
        piezaId = await crear(sesionHistoria, {
            numero_inventario: 'H-001', nombre_designacion: 'Plancha', estado_conservacion: 'Bueno', procedencia: 'Donación',
            material_principal: 'Hierro', largo_cm: 20, usuario_id: 1
        });
        const registros = await auditoria(piezaId);
        assert.equal(registros.length, 1);
        assert.equal(registros[0].accion, 'CREAR');
        assert.equal(registros[0].usuario_id, 2);
        assert.equal(registros[0].museo_id, 2);
        assert.equal(registros[0].detalles.pieza.nombre_designacion, 'Plancha');
        assert.equal(registros[0].detalles.pieza.material_principal, 'Hierro');
        assert.equal(registros[0].detalles.pieza.largo_cm, '20.00');
        assert.equal('categoria' in registros[0].detalles.pieza, false);
    });

    await t.test('EDITAR: guarda solo los campos que cambiaron, con valor anterior y nuevo', async () => {
        const respuesta = await api(sesionHistoria, 'PUT', `/${piezaId}`, {
            numero_inventario: 'H-001', nombre_designacion: 'Plancha a carbón', estado_conservacion: 'Regular', procedencia: 'Donación',
            material_principal: 'Hierro', largo_cm: 20, usuario_id: 1
        });
        assert.equal(respuesta.status, 200);
        const [, edicion] = await auditoria(piezaId);
        assert.equal(edicion.accion, 'EDITAR');
        assert.equal(edicion.usuario_id, 2);
        assert.deepEqual(edicion.detalles.cambios, {
            nombre_designacion: { antes: 'Plancha', despues: 'Plancha a carbón' },
            estado_conservacion: { antes: 'Bueno', despues: 'Regular' }
        });
    });

    await t.test('otro museo no puede editar ni eliminar, y no deja registros', async () => {
        assert.equal((await api(sesionNaturales, 'PUT', `/${piezaId}`, { nombre_designacion: 'X' })).status, 404);
        assert.equal((await api(sesionNaturales, 'DELETE', `/${piezaId}`)).status, 404);
        assert.equal((await api(sesionNaturales, 'DELETE', '', { ids: [piezaId] })).status, 200);
        assert.equal((await auditoria(piezaId)).length, 2);
        assert.equal((await pool.query('SELECT count(*)::int AS n FROM piezas WHERE id = $1', [piezaId])).rows[0].n, 1);
    });

    await t.test('ELIMINAR: conserva una copia de la pieza aunque ya no exista', async () => {
        assert.equal((await api(sesionHistoria, 'DELETE', `/${piezaId}`)).status, 200);
        assert.equal((await pool.query('SELECT count(*)::int AS n FROM piezas WHERE id = $1', [piezaId])).rows[0].n, 0);
        const [, , eliminacion] = await auditoria(piezaId);
        assert.equal(eliminacion.accion, 'ELIMINAR');
        assert.equal(eliminacion.usuario_id, 2);
        assert.equal(eliminacion.detalles.pieza.nombre_designacion, 'Plancha a carbón');
    });

    await t.test('ELIMINAR masivo: un registro por pieza, solo las del propio museo', async () => {
        const propia1 = await crear(sesionNaturales, { numero_inventario: 'N-1', nombre_designacion: 'Fósil', categoria: 'Paleontología', ubicacion_museo: true });
        const propia2 = await crear(sesionNaturales, { numero_inventario: 'N-2', nombre_designacion: 'Roca', categoria: 'Geología', ubicacion_museo: false });
        const ajena = await crear(sesionHistoria, { numero_inventario: 'H-2', nombre_designacion: 'Reloj' });
        assert.equal((await api(sesionNaturales, 'DELETE', '', { ids: [propia1, propia2, ajena] })).status, 200);
        for (const id of [propia1, propia2]) {
            const registros = await auditoria(id);
            assert.deepEqual(registros.map(r => [r.accion, r.usuario_id]), [['CREAR', 1], ['ELIMINAR', 1]]);
        }
        assert.deepEqual((await auditoria(ajena)).map(r => r.accion), ['CREAR']);
        assert.equal((await api(sesionNaturales, 'DELETE', '', { ids: ['1 OR 1=1'] })).status, 400);
    });

    await t.test('si falla la auditoría, el cambio se revierte', async () => {
        await pool.query('ALTER TABLE auditoria_piezas ADD CONSTRAINT bloquear_prueba CHECK (false) NOT VALID');
        try {
            const respuesta = await api(sesionHistoria, 'POST', '', { numero_inventario: 'H-9', nombre_designacion: 'Sin auditar' });
            assert.equal(respuesta.status, 500);
            assert.equal((await pool.query("SELECT count(*)::int AS n FROM piezas WHERE nombre_designacion = 'Sin auditar'")).rows[0].n, 0);
        } finally {
            await pool.query('ALTER TABLE auditoria_piezas DROP CONSTRAINT bloquear_prueba');
        }
    });

    await t.test('historial: solo el museo propio, con autor, nombre de piezas eliminadas, filtros y paginación', async () => {
        const historial = async (Cookie, query = '') => fetch(`${base}/api/piezas/auditoria${query}`, { headers: { Cookie } });
        const respuesta = await historial(sesionHistoria);
        assert.equal(respuesta.status, 200);
        const { registros, hayMas } = await respuesta.json();
        assert.equal(hayMas, false);
        assert.deepEqual(registros.map(r => r.accion), ['CREAR', 'ELIMINAR', 'EDITAR', 'CREAR']);
        assert.ok(registros.every(r => r.username === 'historia'));
        const edicion = registros.find(r => r.accion === 'EDITAR');
        assert.equal(edicion.pieza_existe, false);
        assert.equal(edicion.nombre_designacion, 'Plancha a carbón');
        assert.equal(edicion.numero_inventario, 'H-001');

        assert.equal((await (await historial(sesionHistoria, `?pieza_id=${piezaId}`)).json()).registros.length, 3);
        assert.deepEqual((await (await historial(sesionHistoria, '?accion=ELIMINAR')).json()).registros.map(r => r.pieza_id), [piezaId]);
        const siguiente = await (await historial(sesionHistoria, `?antes_de=${registros[1].id}`)).json();
        assert.deepEqual(siguiente.registros.map(r => r.id), registros.slice(2).map(r => r.id));
        assert.equal((await (await historial(sesionNaturales)).json()).registros.length, 4);

        assert.equal((await historial(sesionHistoria, '?accion=BORRAR')).status, 400);
        assert.equal((await historial(sesionHistoria, '?pieza_id=abc')).status, 400);
        assert.equal((await fetch(`${base}/api/piezas/auditoria`)).status, 401);
        await pool.query("UPDATE usuarios SET rol = 'usuario' WHERE username = 'historia'");
        try {
            assert.equal((await historial(sesionHistoria)).status, 403);
        } finally {
            await pool.query("UPDATE usuarios SET rol = 'encargado' WHERE username = 'historia'");
        }
    });
});
