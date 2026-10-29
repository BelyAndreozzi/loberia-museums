require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../db');
const { validarPassword } = require('../validators/auth');

// Un encargado por museo: reciben las solicitudes de registro y pueden aprobarlas.
const CUENTAS_BASE = [
    { museoId: 1, username: 'AdminMuseoNaturales', email: 'administrador+naturales@gmail.com' },
    { museoId: 2, username: 'AdminMuseoHistoria', email: 'administrador+historia@gmail.com' }
];
const COSTO_BCRYPT = 12;

async function crearCuentasBase() {
    const password = process.env.ADMIN_PASSWORD || '';
    const errorPassword = validarPassword(password, password);
    if (errorPassword) throw new Error(`ADMIN_PASSWORD inválida: ${errorPassword}`);

    const passwordHash = await bcrypt.hash(password, COSTO_BCRYPT);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const cuenta of CUENTAS_BASE) {
            const existente = await client.query(
                'SELECT id FROM usuarios WHERE lower(email) = lower($1) OR lower(username) = lower($2)',
                [cuenta.email, cuenta.username]
            );
            if (existente.rowCount) {
                console.log(`Ya existe ${cuenta.username} (${cuenta.email}); no se modifica.`);
                continue;
            }
            await client.query(
                `INSERT INTO usuarios (username, email, password_hash, rol, museo_id, email_verificado, estado_aprobacion)
                 VALUES ($1, $2, $3, 'encargado', $4, TRUE, 'aprobado')`,
                [cuenta.username, cuenta.email, passwordHash, cuenta.museoId]
            );
            console.log(`Creado encargado ${cuenta.username} (${cuenta.email}) para museo ${cuenta.museoId}.`);
        }
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

crearCuentasBase().catch(error => {
    console.error(error.message.startsWith('ADMIN_PASSWORD') ? error.message : 'No se pudieron crear las cuentas base.');
    process.exitCode = 1;
}).finally(() => pool.end());
