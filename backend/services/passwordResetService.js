const crypto = require('crypto');
const bcrypt = require('bcrypt');
const pool = require('../db');
const { enviarEmailRecuperacion } = require('./emailService');
const { permitirIntento } = require('./rateLimitService');

const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');

const solicitarRecuperacion = async email => {
    if (!await permitirIntento('forgot-email', email, 3)) return;
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    const client = await pool.connect();
    let usuario;
    try {
        await client.query('BEGIN');
        const resultado = await client.query(
            `SELECT id, email, museo_id FROM usuarios
             WHERE lower(email) = $1 AND email_verificado = TRUE FOR UPDATE`, [email]
        );
        usuario = resultado.rows[0];
        if (!usuario) {
            await client.query('ROLLBACK');
            return;
        }
        await client.query(
            `INSERT INTO password_reset_tokens (usuario_id, email, token_hash, expira_en)
             VALUES ($1, $2, $3, clock_timestamp() + INTERVAL '30 minutes')
             ON CONFLICT (usuario_id) DO UPDATE SET email = EXCLUDED.email,
                token_hash = EXCLUDED.token_hash, expira_en = EXCLUDED.expira_en,
                consumido_en = NULL, creado_en = clock_timestamp()`,
            [usuario.id, email, tokenHash]
        );
        await client.query(
            `INSERT INTO password_reset_audit (usuario_id, museo_id, evento) VALUES ($1, $2, 'solicitado')`,
            [usuario.id, usuario.museo_id]
        );
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
    try {
        await enviarEmailRecuperacion(usuario.email, token);
    } catch {
        // Do not invalidate a newer request if SMTP fails after another token was issued.
        await pool.query(
            'UPDATE password_reset_tokens SET consumido_en = clock_timestamp() WHERE token_hash = $1',
            [tokenHash]
        );
        await pool.query(
            `INSERT INTO password_reset_audit (usuario_id, museo_id, evento) VALUES ($1, $2, 'envio_fallido')`,
            [usuario.id, usuario.museo_id]
        );
        console.error('No se pudo enviar el correo de recuperación.');
    }
};

const restablecerPassword = async ({ email, token, password }) => {
    const tokenHash = hashToken(token);
    // Reject unknown/expired tokens before doing expensive bcrypt work.
    const previo = await pool.query(
        `SELECT 1 FROM password_reset_tokens t JOIN usuarios u ON u.id = t.usuario_id
         WHERE t.token_hash = $1 AND t.email = $2 AND lower(u.email) = $2
           AND u.email_verificado = TRUE AND t.consumido_en IS NULL AND t.expira_en > clock_timestamp()`,
        [tokenHash, email]
    );
    if (!previo.rowCount) return false;
    const passwordHash = await bcrypt.hash(password, 12);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const cuenta = await client.query(
            `SELECT u.id, u.museo_id FROM usuarios u JOIN password_reset_tokens t ON t.usuario_id = u.id
             WHERE t.token_hash = $1 AND t.email = $2 AND lower(u.email) = $2
               AND u.email_verificado = TRUE FOR UPDATE OF u`, [tokenHash, email]
        );
        const usuario = cuenta.rows[0];
        if (!usuario) {
            await client.query('ROLLBACK');
            return false;
        }
        const consumido = await client.query(
            `UPDATE password_reset_tokens SET consumido_en = clock_timestamp()
             WHERE usuario_id = $1 AND token_hash = $2 AND email = $3
               AND consumido_en IS NULL AND expira_en > clock_timestamp() RETURNING usuario_id`,
            [usuario.id, tokenHash, email]
        );
        if (!consumido.rowCount) {
            await client.query('ROLLBACK');
            return false;
        }
        // Versioning also rejects sessions issued concurrently from old login/refresh data.
        await client.query(
            `UPDATE usuarios SET password_hash = $1, session_version = session_version + 1 WHERE id = $2`,
            [passwordHash, usuario.id]
        );
        await client.query(
            `INSERT INTO password_reset_audit (usuario_id, museo_id, evento) VALUES ($1, $2, 'restablecido')`,
            [usuario.id, usuario.museo_id]
        );
        await client.query('COMMIT');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

module.exports = { permitirIntento, solicitarRecuperacion, restablecerPassword };
