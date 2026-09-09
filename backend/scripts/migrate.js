require('dotenv').config();
const fs = require('node:fs/promises');
const path = require('node:path');
const pool = require('../db');

async function migrate() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(72341001)');
        await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
            nombre TEXT PRIMARY KEY, aplicado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`);
        const nombre = '001_password_reset.sql';
        const aplicada = await client.query('SELECT 1 FROM schema_migrations WHERE nombre = $1', [nombre]);
        if (!aplicada.rowCount) {
            await client.query(await fs.readFile(path.join(__dirname, '../migrations', nombre), 'utf8'));
            await client.query('INSERT INTO schema_migrations (nombre) VALUES ($1)', [nombre]);
        }
        await client.query('COMMIT');
        console.log(aplicada.rowCount ? 'Migración ya aplicada.' : 'Migración aplicada.');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

migrate().catch(() => {
    console.error('Falló la migración. Transacción revertida; verificá conexión y permisos de base de datos.');
    process.exitCode = 1;
}).finally(() => pool.end());
