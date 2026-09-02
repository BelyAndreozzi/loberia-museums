const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const pool = require('../db');
const { validarRegistro } = require('../validators/auth');
const { enviarEmailVerificacion } = require('../services/emailService');

const router = express.Router();
const COSTO_BCRYPT = 12;
const HORAS_VALIDEZ_TOKEN = 24;

router.post('/register', async (req, res) => {
    const { errores, valores } = validarRegistro(req.body);

    if (Object.keys(errores).length > 0) {
        return res.status(400).json({ error: 'Datos de registro inválidos.', errores });
    }

    try {
        const existente = await pool.query(
            'SELECT username, email FROM usuarios WHERE lower(username) = $1 OR lower(email) = $2',
            [valores.username.toLowerCase(), valores.email]
        );

        const erroresDisponibilidad = {};
        if (existente.rows.some(usuario => usuario.username.toLowerCase() === valores.username.toLowerCase())) {
            erroresDisponibilidad.username = 'El username ya se encuentra registrado.';
        }
        if (existente.rows.some(usuario => usuario.email.toLowerCase() === valores.email)) {
            erroresDisponibilidad.email = 'El email ya se encuentra registrado.';
        }
        if (Object.keys(erroresDisponibilidad).length > 0) {
            return res.status(409).json({ error: 'El usuario ya está registrado.', errores: erroresDisponibilidad });
        }

        const passwordHash = await bcrypt.hash(valores.password, COSTO_BCRYPT);
        const tokenVerificacion = crypto.randomBytes(32).toString('hex');
        const tokenVerificacionHash = crypto.createHash('sha256').update(tokenVerificacion).digest('hex');
        const tokenExpira = new Date(Date.now() + HORAS_VALIDEZ_TOKEN * 60 * 60 * 1000);
        const client = await pool.connect();

        try {
            await client.query('BEGIN');
            const resultado = await client.query(
                `INSERT INTO usuarios (username, email, password_hash, token_verificacion_hash, token_verificacion_expira)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING id, username, email, fecha_registro`,
                [valores.username, valores.email, passwordHash, tokenVerificacionHash, tokenExpira]
            );

            await enviarEmailVerificacion(valores.email, tokenVerificacion);
            await client.query('COMMIT');

            return res.status(201).json({
                mensaje: 'Registro correcto. Revisa tu email para verificar la cuenta.',
                usuario: resultado.rows[0]
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'El username o email ya se encuentra registrado.' });
        }
        console.error('Error al registrar el usuario:', error);
        return res.status(500).json({ error: 'No se pudo registrar el usuario.' });
    }
});

router.get('/verify-email', async (req, res) => {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    if (!token) {
        return res.status(400).json({ error: 'El token de verificación es obligatorio.' });
    }

    try {
        const resultado = await pool.query(
            `UPDATE usuarios
             SET email_verificado = TRUE, token_verificacion_hash = NULL, token_verificacion_expira = NULL
             WHERE token_verificacion_hash = $1
               AND token_verificacion_expira > CURRENT_TIMESTAMP
             RETURNING id`,
            [tokenHash]
        );

        if (resultado.rowCount === 0) {
            return res.status(400).json({ error: 'El enlace no es válido o ya expiró.' });
        }

        return res.json({ mensaje: 'Email verificado correctamente.' });
    } catch (error) {
        console.error('Error al verificar el email:', error);
        return res.status(500).json({ error: 'No se pudo verificar el email.' });
    }
});

module.exports = router;