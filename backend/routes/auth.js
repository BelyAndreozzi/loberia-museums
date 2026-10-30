const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const pool = require('../db');
const { validarRegistro, normalizarMuseoId } = require('../validators/auth');
const { enviarEmailVerificacion, enviarEmailAprobacionRegistro } = require('../services/emailService');
const autenticarAccessToken = require('../middleware/autenticacion');
const { requiereRol } = require('../middleware/autorizacion');
const { limitarLogin, limitarRegistro } = require('../middleware/authRateLimit');
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
const DIAS_VALIDEZ_APROBACION = 7;

const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');

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
        `INSERT INTO refresh_tokens (usuario_id, token_hash, expira_en, session_version)
         VALUES ($1, $2, $3, $4)`,
        [usuario.id, refreshTokenHash, expira, usuario.session_version]
    );

    res.cookie('jwt', accessToken, { ...opcionesCookie, maxAge: 24 * 60 * 60 * 1000 });
    res.cookie('refreshToken', refreshToken, { ...opcionesRefreshCookie, maxAge: REFRESH_TOKEN_MAX_AGE });

    return accessToken;
};

router.post('/login', limitarLogin, async (req, res) => {
    const museoId = normalizarMuseoId(req.body?.museo_id);
    if (!museoId) {
        return res.status(400).json({ error: 'Debes seleccionar un museo válido.' });
    }
    if (req.cookies.jwt) {
        try {
            const payload = verificarAccessToken(req.cookies.jwt);
            const activa = req.cookies.refreshToken && await pool.query(
                `SELECT u.museo_id FROM refresh_tokens rt JOIN usuarios u ON u.id = rt.usuario_id
                 WHERE rt.token_hash = $1 AND u.id = $2 AND rt.expira_en > CURRENT_TIMESTAMP
                   AND rt.session_version = u.session_version`,
                [hashRefreshToken(req.cookies.refreshToken), payload.id]
            );
            if (activa?.rowCount) {
                return res.status(409).json({ error: Number(activa.rows[0].museo_id) === museoId
                    ? 'Ya estás logueado.'
                    : 'Hay una sesión activa en otro museo. Cerrá esa sesión para continuar.' });
            }
            limpiarCookiesSesion(res);
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
            `SELECT id, username, password_hash, rol, museo_id, email_verificado, estado_aprobacion, session_version
             FROM usuarios
             WHERE lower(email) = $1 AND museo_id = $2`,
            [email, museoId]
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

        if (cuenta.estado_aprobacion !== 'aprobado') {
            limpiarCookiesSesion(res);
            return res.status(403).json({ error: cuenta.estado_aprobacion === 'rechazado'
                ? 'Tu solicitud de registro fue rechazada.'
                : 'Tu cuenta está pendiente de aprobación por el encargado del museo.' });
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
            `DELETE FROM refresh_tokens rt USING usuarios u
             WHERE rt.token_hash = $1 AND rt.expira_en > CURRENT_TIMESTAMP
               AND u.id = rt.usuario_id AND rt.session_version = u.session_version
             RETURNING rt.usuario_id, rt.session_version`,
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

        await establecerTokens(res, {
            ...usuarioResultado.rows[0], session_version: resultado.rows[0].session_version
        }, client);
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

router.post('/register', limitarRegistro, async (req, res) => {
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
        const tokenVerificacionHash = hashToken(tokenVerificacion);
        const tokenExpira = new Date(Date.now() + HORAS_VALIDEZ_TOKEN * 60 * 60 * 1000);
        const tokenAprobacion = crypto.randomBytes(32).toString('hex');
        const tokenAprobacionHash = hashToken(tokenAprobacion);
        const aprobacionExpira = new Date(Date.now() + DIAS_VALIDEZ_APROBACION * 24 * 60 * 60 * 1000);
        const client = await pool.connect();
        let solicitud;
        let encargados;

        try {
            await client.query('BEGIN');
            const resultado = await client.query(
                `INSERT INTO usuarios (username, email, password_hash, museo_id, token_verificacion_hash, token_verificacion_expira)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING id, username, email, museo_id, fecha_registro`,
                [valores.username, valores.email, passwordHash, valores.museo_id, tokenVerificacionHash, tokenExpira]
            );

            solicitud = resultado.rows[0];
            const museo = await client.query('SELECT nombre FROM museos WHERE id = $1', [valores.museo_id]);
            if (!museo.rowCount) throw new Error('Museo no encontrado.');
            await client.query(
                `INSERT INTO registro_aprobaciones (usuario_id, token_hash, expira_en)
                 VALUES ($1, $2, $3)`,
                [solicitud.id, tokenAprobacionHash, aprobacionExpira]
            );
            encargados = await client.query(
                `SELECT email FROM usuarios
                 WHERE museo_id = $1 AND rol = 'encargado' AND email_verificado = TRUE
                   AND estado_aprobacion = 'aprobado'`,
                [valores.museo_id]
            );
            solicitud.museo_nombre = museo.rows[0].nombre;

            // Si falla el email de verificación se revierte el registro, así el usuario puede reintentar.
            await enviarEmailVerificacion(valores.email, tokenVerificacion);
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

        if (!encargados.rowCount) {
            console.error(`Registro pendiente sin encargado configurado para museo ${valores.museo_id}.`);
        }
        const envios = await Promise.allSettled(encargados.rows.map(({ email }) => enviarEmailAprobacionRegistro({
            destinatario: email,
            username: solicitud.username,
            email: solicitud.email,
            museo: solicitud.museo_nombre,
            token: tokenAprobacion,
            diasValidez: DIAS_VALIDEZ_APROBACION
        })));
        const fallidos = envios.filter(envio => envio.status === 'rejected').length;
        if (fallidos) {
            console.error(`No se pudo avisar a ${fallidos} encargado(s) del registro pendiente ${solicitud.id}.`);
        }

        return res.status(201).json({
            mensaje: 'Registro correcto. Revisá tu email para verificar la cuenta; un encargado del museo deberá aprobar tu solicitud.',
            usuario: solicitud
        });
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
    const tokenHash = hashToken(token);

    if (!token) {
        return res.status(400).json({ error: 'El token de verificación es obligatorio.' });
    }

    try {
        const resultado = await pool.query(
            `UPDATE usuarios
             SET email_verificado = TRUE, token_verificacion_hash = NULL, token_verificacion_expira = NULL
             WHERE token_verificacion_hash = $1
               AND token_verificacion_expira > CURRENT_TIMESTAMP
             RETURNING id, estado_aprobacion`,
            [tokenHash]
        );

        if (resultado.rowCount === 0) {
            return res.status(400).json({ error: 'El enlace no es válido o ya expiró.' });
        }

        return res.json({ mensaje: resultado.rows[0].estado_aprobacion === 'pendiente'
            ? 'Email verificado correctamente. Podrás iniciar sesión cuando un encargado del museo apruebe tu solicitud.'
            : 'Email verificado correctamente.' });
    } catch (error) {
        console.error('Error al verificar el email:', error);
        return res.status(500).json({ error: 'No se pudo verificar el email.' });
    }
});

// El enlace solo no alcanza: además hace falta sesión de encargado del mismo museo que la solicitud.
router.post('/registration-approval', autenticarAccessToken, requiereRol('encargado'), async (req, res) => {
    const token = typeof req.body?.token === 'string' ? req.body.token : '';
    const decision = req.body?.decision;
    if (!/^[a-f0-9]{64}$/.test(token) || !['aprobado', 'rechazado'].includes(decision)) {
        return res.status(400).json({ error: 'La solicitud no es válida.' });
    }
    const origen = process.env.FRONTEND_URL || 'http://localhost:5173';
    if (req.get('Origin') && req.get('Origin') !== origen) {
        return res.status(403).json({ error: 'Solicitud no permitida.' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const aprobacion = await client.query(
            `UPDATE registro_aprobaciones ra
             SET decision = $1, decidido_en = CURRENT_TIMESTAMP
             FROM usuarios u
             WHERE ra.token_hash = $2 AND ra.decision IS NULL AND ra.expira_en > CURRENT_TIMESTAMP
               AND u.id = ra.usuario_id AND u.museo_id = $3
             RETURNING ra.usuario_id`,
            [decision, hashToken(token), req.user.museo_id]
        );
        if (!aprobacion.rowCount) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'El enlace no es válido, ya fue usado, expiró o no corresponde a tu museo.' });
        }
        await client.query('UPDATE usuarios SET estado_aprobacion = $1 WHERE id = $2', [decision, aprobacion.rows[0].usuario_id]);
        await client.query('COMMIT');
        return res.json({ mensaje: decision === 'aprobado' ? 'Solicitud aprobada.' : 'Solicitud rechazada.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al decidir solicitud de registro:', error);
        return res.status(500).json({ error: 'No se pudo procesar la solicitud.' });
    } finally {
        client.release();
    }
});

module.exports = router;
