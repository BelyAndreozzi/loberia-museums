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
// Windows PostgreSQL children can inherit pipes; wait on process exit, without piped stdio.
const controlar = (binario, args) => new Promise((resolve, reject) => {
    const child = spawn(binario, args, { windowsHide: true, stdio: 'ignore' });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`pg_ctl falló: ${code}`)));
});

test('recuperación completa en PostgreSQL aislado', { skip: !process.env.PG_BIN, timeout: 120000 }, async t => {
    const carpeta = await fs.mkdtemp(path.join(os.tmpdir(), 'museos-password-reset-'));
    const data = path.join(carpeta, 'data');
    const bin = nombre => path.join(process.env.PG_BIN, `${nombre}${process.platform === 'win32' ? '.exe' : ''}`);
    const libre = net.createServer();
    await new Promise(resolve => libre.listen(0, '127.0.0.1', resolve));
    const puerto = libre.address().port;
    await new Promise(resolve => libre.close(resolve));
    await ejecutar(bin('initdb'), ['-D', data, '-U', 'reset_test', '--auth=trust', '--encoding=UTF8', '--locale=C'], { windowsHide: true });
    await controlar(bin('pg_ctl'), ['-D', data, '-l', path.join(carpeta, 'postgres.log'), '-o', `-p ${puerto} -h 127.0.0.1`, '-w', 'start']);
    let pool;
    let server;
    t.after(async () => {
        if (server) await new Promise(resolve => server.close(resolve));
        if (pool) await pool.end();
        await controlar(bin('pg_ctl'), ['-D', data, '-m', 'fast', '-w', 'stop']);
        // Keep temporary files: no automatic deletion of databases/files.
    });
    Object.assign(process.env, {
        DB_HOST: '127.0.0.1', DB_PORT: String(puerto), DB_USER: 'reset_test', DB_PASSWORD: '', DB_NAME: 'postgres',
        JWT_SECRET: crypto.randomBytes(48).toString('hex'), FRONTEND_URL: 'http://localhost:5173', NODE_ENV: 'test',
    });
    pool = require('../db');
    const bcrypt = require('bcrypt');
    const correos = [];
    let fallarCorreo = false;
    require('../services/emailService').enviarEmailRecuperacion = async (email, token) => {
        if (fallarCorreo) throw new Error('Fallo SMTP simulado');
        correos.push({ email, token });
    };
    const verificaciones = [];
    require('../services/emailService').enviarEmailVerificacion = async email => verificaciones.push(email);
    const service = require('../services/passwordResetService');
    const tokenService = require('../services/tokenService');
    const express = require('express');
    const app = express();
    app.use(express.json());
    app.use(require('cookie-parser')());
    app.use('/api/auth', require('../routes/passwordReset'));
    app.use('/api/auth', require('../routes/auth'));
    app.use('/api/usuarios', require('../middleware/autenticacion'), require('../routes/usuarios'));
    app.get('/privado', require('../middleware/autenticacion'), (req, res) => res.json(req.user));
    server = await new Promise(resolve => {
        const servidor = app.listen(0, '127.0.0.1', () => resolve(servidor));
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    const post = (ruta, body, headers = {}) => fetch(`${base}/api/auth/${ruta}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Origin: process.env.FRONTEND_URL, ...headers },
        body: JSON.stringify({ ...(ruta === 'login' ? { museo_id: 1 } : {}), ...body }),
    });
    await pool.query(`CREATE TABLE museos (id INTEGER PRIMARY KEY, nombre TEXT);
        INSERT INTO museos VALUES (1, 'Ciencias Naturales'), (2, 'Historia');
        CREATE TABLE usuarios (
        id SERIAL PRIMARY KEY, username TEXT, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
        rol TEXT NOT NULL DEFAULT 'usuario', museo_id INTEGER, email_verificado BOOLEAN NOT NULL DEFAULT FALSE,
        token_verificacion_hash VARCHAR(64), token_verificacion_expira TIMESTAMP,
        fecha_registro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ); CREATE TABLE refresh_tokens (
        id SERIAL PRIMARY KEY, usuario_id INTEGER NOT NULL REFERENCES usuarios(id), token_hash VARCHAR(64) UNIQUE,
        expira_en TIMESTAMP NOT NULL
    )`);
    // Run the actual migration runner twice, including tracking/idempotency.
    for (let i = 0; i < 2; i++) await ejecutar(process.execPath, [path.join(__dirname, '../scripts/migrate.js')], { windowsHide: true, env: process.env });
    const password = 'NuevaSegura123';
    const anterior = await bcrypt.hash('Anterior123', 4);
    await pool.query(`INSERT INTO usuarios (username, email, password_hash, museo_id, email_verificado)
        VALUES ('uno', 'uno@example.com', $1, 1, TRUE), ('dos', 'dos@example.com', $1, 2, TRUE),
               ('tres', 'tres@example.com', $1, 1, FALSE)`, [anterior]);
    const datos = (token, email = 'uno@example.com') => ({ email, token, password, confirmPassword: password });

    await t.test('solicitud sin enumeración y token guardado como hash', async () => {
        const a = await post('forgot-password', { email: ' UNO@EXAMPLE.COM ' });
        const b = await post('forgot-password', { email: 'inexistente@example.com' });
        assert.equal(a.status, 200);
        assert.deepEqual(await a.json(), await b.json());
        for (let i = 0; i < 100 && !correos.length; i++) await new Promise(resolve => setTimeout(resolve, 20));
        assert.equal(correos.length, 1);
        const guardado = (await pool.query('SELECT * FROM password_reset_tokens')).rows[0];
        assert.notEqual(guardado.token_hash, correos[0].token);
        assert.equal(guardado.token_hash, crypto.createHash('sha256').update(correos[0].token).digest('hex'));
        await service.solicitarRecuperacion('tres@example.com');
        assert.equal(correos.length, 1);
    });
    await t.test('deniega origen ajeno, datos inválidos, email/token incorrectos y otra cuenta/museo', async () => {
        assert.equal((await post('forgot-password', { email: 'uno@example.com' }, { Origin: 'https://ajeno.example' })).status, 403);
        assert.equal((await post('forgot-password', { email: {} })).status, 400);
        assert.equal((await post('reset-password', datos('x'))).status, 400);
        assert.equal((await post('reset-password', datos(correos[0].token, 'dos@example.com'))).status, 400);
        assert.equal((await post('reset-password', datos('a'.repeat(64)))).status, 400);
        assert.equal((await post('reset-password', { ...datos(correos[0].token), password: 'debil' })).status, 400);
    });
    await t.test('token vencido y reemplazado denegados', async () => {
        await pool.query("UPDATE password_reset_tokens SET expira_en = clock_timestamp() - INTERVAL '1 second'");
        assert.equal(await service.restablecerPassword(datos(correos[0].token)), false);
        await service.solicitarRecuperacion('uno@example.com');
        assert.equal(await service.restablecerPassword(datos(correos[0].token)), false);
    });
    await t.test('rollback revierte consumo y contraseña si falla auditoría', async () => {
        await pool.query(`CREATE FUNCTION fallar_auditoria() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN IF NEW.evento = 'restablecido' THEN RAISE EXCEPTION 'fallo simulado'; END IF; RETURN NEW; END $$;
            CREATE TRIGGER fallo_auditoria BEFORE INSERT ON password_reset_audit FOR EACH ROW EXECUTE FUNCTION fallar_auditoria()`);
        await assert.rejects(service.restablecerPassword(datos(correos.at(-1).token)));
        const token = (await pool.query('SELECT consumido_en FROM password_reset_tokens WHERE usuario_id = 1')).rows[0];
        assert.equal(token.consumido_en, null);
        assert.equal((await pool.query('SELECT password_hash FROM usuarios WHERE id = 1')).rows[0].password_hash, anterior);
        await pool.query('ALTER TABLE password_reset_audit DISABLE TRIGGER fallo_auditoria');
    });
    let cookies;
    await t.test('sesión previa funciona; solo un cambio simultáneo puede consumir el token', async () => {
        const rt = tokenService.crearRefreshToken();
        await pool.query("INSERT INTO refresh_tokens (usuario_id, token_hash, expira_en) VALUES (1, $1, CURRENT_TIMESTAMP + INTERVAL '1 day')", [tokenService.hashRefreshToken(rt)]);
        cookies = `jwt=${tokenService.crearAccessToken({ id: 1, rol: 'usuario', museo_id: 1 })}; refreshToken=${rt}`;
        assert.equal((await fetch(`${base}/privado`, { headers: { Cookie: cookies } })).status, 200);
        const resultados = await Promise.all([post('reset-password', datos(correos.at(-1).token)), post('reset-password', datos(correos.at(-1).token))]);
        assert.deepEqual(resultados.map(respuesta => respuesta.status).sort(), [200, 400]);
        assert.equal(await service.restablecerPassword(datos(correos.at(-1).token)), false);
        const usuarios = (await pool.query('SELECT * FROM usuarios ORDER BY id')).rows;
        assert.equal(await bcrypt.compare(password, usuarios[0].password_hash), true);
        assert.equal(usuarios[0].session_version, 1);
        assert.equal(usuarios[0].rol, 'usuario');
        assert.equal(usuarios[0].museo_id, 1);
        assert.equal(usuarios[1].password_hash, anterior);
        assert.equal(usuarios[1].session_version, 0);
    });
    await t.test('sesiones anteriores rechazadas, incluido refresh tardío con versión vieja', async () => {
        assert.equal((await fetch(`${base}/privado`, { headers: { Cookie: cookies } })).status, 401);
        assert.equal((await post('refresh', {}, { Cookie: cookies })).status, 401);
        const rt = tokenService.crearRefreshToken();
        await pool.query("INSERT INTO refresh_tokens (usuario_id, token_hash, expira_en, session_version) VALUES (1, $1, CURRENT_TIMESTAMP + INTERVAL '1 day', 0)", [tokenService.hashRefreshToken(rt)]);
        assert.equal((await fetch(`${base}/privado`, { headers: { Cookie: `refreshToken=${rt}` } })).status, 401);
        assert.equal((await post('login', { email: 'uno@example.com', password: 'Anterior123' })).status, 401);
        const login = await post('login', { email: 'uno@example.com', password }, { Cookie: cookies });
        assert.equal(login.status, 200);
        // Browser applies Set-Cookie in order: newer values replace preceding clears.
        const jar = new Map(login.headers.getSetCookie().map(cookie => {
            const par = cookie.split(';')[0];
            return [par.slice(0, par.indexOf('=')), par];
        }));
        const nuevasCookies = [...jar.values()].join('; ');
        assert.equal((await fetch(`${base}/privado`, { headers: { Cookie: nuevasCookies } })).status, 200);
        const refresh = await post('refresh', {}, { Cookie: nuevasCookies });
        assert.equal(refresh.status, 200);
        const soloRefresh = refresh.headers.getSetCookie().find(cookie => cookie.startsWith('refreshToken=')).split(';')[0];
        assert.equal((await fetch(`${base}/privado`, { headers: { Cookie: soloRefresh } })).status, 200);
    });
    await t.test('fallo SMTP invalida token y límite persistente resiste concurrencia', async () => {
        fallarCorreo = true;
        await service.solicitarRecuperacion('dos@example.com');
        assert.ok((await pool.query('SELECT consumido_en FROM password_reset_tokens WHERE usuario_id = 2')).rows[0].consumido_en);
        const resultados = await Promise.all(Array.from({ length: 12 }, () => service.permitirIntento('prueba', 'valor', 3)));
        assert.equal(resultados.filter(Boolean).length, 3);
        for (let i = 0; i < 20; i++) await service.permitirIntento('reset-ip', '127.0.0.1', 20);
        assert.equal((await post('reset-password', datos('b'.repeat(64)))).status, 429);
    });

    const expirarLimite = async (ambito, valor) => {
        const clave = crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${ambito}:${valor}`).digest('hex');
        await pool.query("UPDATE auth_rate_limits SET expira_en = clock_timestamp() - INTERVAL '1 second' WHERE clave = $1", [clave]);
    };
    await t.test('login: mismo límite para email existente/inexistente y normalización de mayúsculas', async () => {
        await expirarLimite('login-ip', '127.0.0.1');
        const bloqueadas = [];
        for (const email of ['dos@example.com', 'ausente@example.com']) {
            for (let i = 0; i < 5; i++) {
                assert.equal((await post('login', { email, password: 'Incorrecta123' })).status, 401);
            }
            const respuesta = await post('login', { email: ` ${email.toUpperCase()} `, password: 'Incorrecta123' });
            assert.equal(respuesta.status, 429);
            assert.equal(respuesta.headers.get('Retry-After'), '900');
            assert.equal(respuesta.headers.get('Cache-Control'), 'no-store');
            assert.equal(respuesta.headers.get('Set-Cookie'), null);
            bloqueadas.push(await respuesta.json());
        }
        assert.deepEqual(bloqueadas[0], bloqueadas[1]);
    });
    await t.test('login: IP limita concurrencia/cambio de email y no confía en X-Forwarded-For', async () => {
        await expirarLimite('login-ip', '127.0.0.1');
        const respuestas = await Promise.all(Array.from({ length: 21 }, (_, i) =>
            post('login', { email: `intento${i}@example.com`, password: 'Incorrecta123' }, { 'X-Forwarded-For': `192.0.2.${i + 1}` })
        ));
        assert.equal(respuestas.filter(respuesta => respuesta.status === 401).length, 20);
        assert.equal(respuestas.filter(respuesta => respuesta.status === 429).length, 1);
        await expirarLimite('login-ip', '127.0.0.1');
        assert.equal((await post('login', { email: 'despues@example.com', password: 'Incorrecta123' })).status, 401);
    });
    await t.test('registro: permite alta normal, limita email y bloquea IP antes de crear cuenta/enviar correo', async () => {
        const registro = { username: 'nuevo', email: 'nuevo@example.com', password: 'Segura123', confirmPassword: 'Segura123', museo_id: 2 };
        assert.equal((await post('register', registro)).status, 201);
        assert.deepEqual(verificaciones, ['nuevo@example.com']);
        const cuentaNueva = (await pool.query("SELECT email_verificado, museo_id, rol FROM usuarios WHERE email = 'nuevo@example.com'")).rows[0];
        assert.equal(cuentaNueva.email_verificado, false);
        assert.equal(cuentaNueva.museo_id, 2);
        assert.equal(cuentaNueva.rol, 'usuario');
        for (let i = 0; i < 3; i++) {
            assert.equal((await post('register', { email: 'repetido@example.com' })).status, 400);
        }
        const emailBloqueado = await post('register', { email: ' REPETIDO@EXAMPLE.COM ' });
        assert.equal(emailBloqueado.status, 429);
        const ipBloqueada = await post('register', { ...registro, username: 'otro', email: 'otro@example.com' });
        assert.equal(ipBloqueada.status, 429);
        assert.equal(ipBloqueada.headers.get('Retry-After'), '900');
        assert.equal((await pool.query("SELECT 1 FROM usuarios WHERE email = 'otro@example.com'")).rowCount, 0);
        assert.equal(verificaciones.length, 1);
        await expirarLimite('register-ip', '127.0.0.1');
        const simultaneas = await Promise.all(Array.from({ length: 6 }, () => post('register', {})));
        assert.equal(simultaneas.filter(respuesta => respuesta.status === 400).length, 5);
        assert.equal(simultaneas.filter(respuesta => respuesta.status === 429).length, 1);
    });
    await t.test('login/registro: cambiar IP no evita límite por email; ventanas y rutas independientes', async () => {
        const { limitarLogin, limitarRegistro } = require('../middleware/authRateLimit');
        const invocar = async (middleware, ip) => {
            let estado = 0;
            const res = { set() {}, status(code) { estado = code; return this; }, json() {} };
            await middleware({ ip, body: { email: ' Distribuido@Example.com ' } }, res, () => { estado = 200; });
            return estado;
        };
        for (const [middleware, ambito, limite] of [[limitarLogin, 'login', 5], [limitarRegistro, 'register', 3]]) {
            for (let i = 0; i < limite; i++) assert.equal(await invocar(middleware, `198.51.100.${i}`), 200);
            assert.equal(await invocar(middleware, '198.51.100.100'), 429);
            await expirarLimite(`${ambito}-email`, 'distribuido@example.com');
            assert.equal(await invocar(middleware, '198.51.100.101'), 200);
        }
    });
    await t.test('login por museo: deniega museo omitido, inválido y tipos manipulados', async () => {
        await expirarLimite('login-ip', '127.0.0.1');
        for (const museo_id of [undefined, null, 0, 3, true, [1], { id: 1 }, '1 OR 1=1']) {
            assert.equal((await post('login', { museo_id })).status, 400);
        }
    });
    await t.test('login por museo: contraseña correcta no permite cruzar museo, tampoco con admin/encargado', async () => {
        await expirarLimite('login-ip', '127.0.0.1');
        await expirarLimite('login-email', 'uno@example.com');
        const sesionesAntes = (await pool.query('SELECT count(*) FROM refresh_tokens WHERE usuario_id = 1')).rows[0].count;
        for (const rol of ['usuario', 'admin', 'encargado']) {
            await pool.query('UPDATE usuarios SET rol = $1 WHERE id = 1', [rol]);
            const respuesta = await post('login', { email: 'uno@example.com', password, museo_id: 2 });
            assert.equal(respuesta.status, 401);
            assert.deepEqual(await respuesta.json(), { error: 'Usuario o contraseña incorrectos.' });
        }
        assert.equal((await pool.query('SELECT count(*) FROM refresh_tokens WHERE usuario_id = 1')).rows[0].count, sesionesAntes);
        await pool.query("UPDATE usuarios SET rol = 'usuario' WHERE id = 1");
        const correcto = await post('login', { email: 'uno@example.com', password, museo_id: '1' });
        assert.equal(correcto.status, 200);
        assert.equal((await correcto.json()).usuario.museo_id, 1);
        const cookie = correcto.headers.getSetCookie().map(valor => valor.split(';')[0]).join('; ');
        const otraSesion = await post('login', { email: 'uno@example.com', password, museo_id: 2 }, { Cookie: cookie });
        assert.equal(otraSesion.status, 409);
        assert.equal(otraSesion.headers.get('Set-Cookie'), null);
        const identidad = await fetch(`${base}/privado?museo_id=2`, { headers: { Cookie: cookie } });
        assert.equal((await identidad.json()).museo_id, 1);
        await expirarLimite('login-email', 'dos@example.com');
        assert.equal((await post('login', { email: 'dos@example.com', password: 'Anterior123', museo_id: 1 })).status, 401);
        const historia = await post('login', { email: 'dos@example.com', password: 'Anterior123', museo_id: 2 });
        assert.equal(historia.status, 200);
        assert.equal((await historia.json()).usuario.museo_id, 2);
    });
    await t.test('gestión de usuarios: limita listado al museo y deniega cambios de rol cross-tenant/sin permiso', async () => {
        await expirarLimite('login-ip', '127.0.0.1');
        await expirarLimite('login-email', 'uno@example.com');
        const login = await post('login', { email: 'uno@example.com', password, museo_id: 1 });
        assert.equal(login.status, 200);
        const Cookie = login.headers.getSetCookie().map(valor => valor.split(';')[0]).join('; ');
        const cambiarRol = id => fetch(`${base}/api/usuarios/${id}/rol`, {
            method: 'PUT', headers: { Cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ rol: 'admin', museo_id: 2 }),
        });
        assert.equal((await fetch(`${base}/api/usuarios`)).status, 401);
        assert.equal((await fetch(`${base}/api/usuarios`, { headers: { Cookie } })).status, 403);
        assert.equal((await cambiarRol(3)).status, 403);
        await pool.query("UPDATE usuarios SET rol = 'admin' WHERE id = 1");
        const listado = await fetch(`${base}/api/usuarios?museo_id=2`, { headers: { Cookie } });
        assert.equal(listado.status, 200);
        const usuarios = await listado.json();
        assert.ok(usuarios.length > 0);
        assert.ok(usuarios.every(usuario => usuario.museo_id === 1));
        assert.equal((await cambiarRol(2)).status, 403);
        await pool.query("UPDATE usuarios SET rol = 'encargado' WHERE id = 1");
        assert.equal((await cambiarRol(2)).status, 404);
        assert.equal((await pool.query('SELECT rol FROM usuarios WHERE id = 2')).rows[0].rol, 'usuario');
        assert.equal((await cambiarRol(3)).status, 200);
    });
    await t.test('login/registro: deniega sin emitir sesiones/correos si falla almacenamiento del límite', async () => {
        const original = pool.query;
        pool.query = async () => { throw new Error('Fallo DB simulado'); };
        try {
            for (const ruta of ['login', 'register']) {
                const respuesta = await post(ruta, { email: 'uno@example.com', password });
                assert.equal(respuesta.status, 503);
                assert.equal(respuesta.headers.get('Set-Cookie'), null);
                assert.deepEqual(await respuesta.json(), { error: 'No se pudo procesar la solicitud. Intentá nuevamente.' });
            }
            assert.equal(verificaciones.length, 1);
        } finally {
            pool.query = original;
        }
    });
});
