const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const pool = require('../db');
const { validarRegistro } = require('../validators/auth');
const { enviarEmailVerificacion } = require('../services/emailService');
const autenticarAccessToken = require('../middleware/autenticacion');
const {
    REFRESH_TOKEN_MAX_AGE,
    crearAccessToken,
    crearRefreshToken,
    hashRefreshToken,
    verificarAccessToken
} = require('../services/tokenService');

const router = express.Router();
const COSTO_BCRYPT = 12;
const HORAS_VALIDEZ_TOKEN = 24;

//Hacemos esto así, ya que en local no podemos dejar el JWT como httpOnly true ni strict.

const opcionesCookie = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    path: '/'
};

const opcionesRefreshCookie = { ...opcionesCookie, path: '/' };

const limpiarCookiesSesion = res => {
    res.clearCookie('jwt', opcionesCookie);
    res.clearCookie('refreshToken', opcionesRefreshCookie);
};

const establecerTokens = async (res, usuario, client = pool) => {
    await client.query('DELETE FROM refresh_tokens WHERE expira_en <= CURRENT_TIMESTAMP');
    const accessToken = crearAccessToken(usuario);
    const refreshToken = crearRefreshToken();
    const refreshTokenHash = hashRefreshToken(refreshToken);
    const expira = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE);

    await client.query(
        `INSERT INTO refresh_tokens (usuario_id, token_hash, expira_en)
         VALUES ($1, $2, $3)`,
        [usuario.id, refreshTokenHash, expira]
    );

    res.cookie('jwt', accessToken, { ...opcionesCookie, maxAge: 24 * 60 * 60 * 1000 });
    res.cookie('refreshToken', refreshToken, { ...opcionesRefreshCookie, maxAge: REFRESH_TOKEN_MAX_AGE });

    return accessToken;
};

router.post('/login', async (req, res) => {
    if (req.cookies.jwt) {
        try {
            verificarAccessToken(req.cookies.jwt);
            return res.status(409).json({ error: 'Ya estás logueado.' });
        } catch {
            limpiarCookiesSesion(res);
        }
    }

    const datos = req.body || {};
    const email = typeof datos.email === 'string' ? datos.email.trim().toLowerCase() : '';
    const password = typeof datos.contraseña === 'string'
        ? datos.contraseña
        : typeof datos.password === 'string' ? datos.password : '';

    if (!email || !password) {
        limpiarCookiesSesion(res);
        return res.status(400).json({ error: 'El email y la contraseña son obligatorios.' });
    }

    try {
        await pool.query('DELETE FROM refresh_tokens WHERE expira_en <= CURRENT_TIMESTAMP');
        const resultado = await pool.query(
            `SELECT id, username, password_hash, rol, museo_id, email_verificado
             FROM usuarios
             WHERE lower(email) = $1`,
            [email]
        );
        const cuenta = resultado.rows[0];
        const passwordValida = cuenta ? await bcrypt.compare(password, cuenta.password_hash) : false;

        if (!passwordValida) {
            limpiarCookiesSesion(res);
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
        }

        if (!cuenta.email_verificado) {
            limpiarCookiesSesion(res);
            return res.status(403).json({ error: 'Debes verificar tu email antes de iniciar sesión.' });
        }

        await establecerTokens(res, cuenta);
        return res.json({
            mensaje: 'Inicio de sesión correcto.',
            usuario: { id: cuenta.id, username: cuenta.username, rol: cuenta.rol, museo_id: cuenta.museo_id }
        });
    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        return res.status(500).json({ error: 'No se pudo iniciar sesión.' });
    }
});

router.get('/me', autenticarAccessToken, async (req, res) => {
    try {
        const resultado = await pool.query(
            'SELECT id, username, rol, museo_id FROM usuarios WHERE id = $1',
            [req.user.id]
        );

        if (resultado.rowCount === 0) {
            return res.status(401).json({ error: 'La sesión ya no es válida.' });
        }

        return res.json({ usuario: resultado.rows[0] });
    } catch (error) {
        console.error('Error al consultar la sesión:', error);
        return res.status(500).json({ error: 'No se pudo consultar la sesión.' });
    }
});

router.post('/refresh', async (req, res) => {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
        return res.status(401).json({ error: 'La sesión expiró. Inicia sesión nuevamente.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM refresh_tokens WHERE expira_en <= CURRENT_TIMESTAMP');
        const resultado = await client.query(
            `DELETE FROM refresh_tokens
             WHERE token_hash = $1 AND expira_en > CURRENT_TIMESTAMP
             RETURNING usuario_id`,
            [hashRefreshToken(refreshToken)]
        );
        if (resultado.rowCount === 0) {
            await client.query('ROLLBACK');
            limpiarCookiesSesion(res);
            return res.status(401).json({ error: 'El refresh token no es válido o expiró.' });
        }

        const usuarioResultado = await client.query(
            'SELECT id, rol, museo_id FROM usuarios WHERE id = $1',
            [resultado.rows[0].usuario_id]
        );
        if (usuarioResultado.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(401).json({ error: 'La sesión ya no es válida.' });
        }

        await establecerTokens(res, usuarioResultado.rows[0], client);
        await client.query('COMMIT');
        return res.json({ mensaje: 'Sesión renovada correctamente.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al renovar la sesión:', error);
        return res.status(500).json({ error: 'No se pudo renovar la sesión.' });
    } finally {
        client.release();
    }
});

router.post('/logout', async (req, res) => {
    try {
        if (req.cookies.refreshToken) {
            await pool.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [hashRefreshToken(req.cookies.refreshToken)]);
        }
        limpiarCookiesSesion(res);
        return res.json({ mensaje: 'Sesión cerrada correctamente.' });
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        return res.status(500).json({ error: 'No se pudo cerrar la sesión.' });
    }
});

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
                `INSERT INTO usuarios (username, email, password_hash, museo_id, token_verificacion_hash, token_verificacion_expira)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING id, username, email, museo_id, fecha_registro`,
                [valores.username, valores.email, passwordHash, valores.museo_id, tokenVerificacionHash, tokenExpira]
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