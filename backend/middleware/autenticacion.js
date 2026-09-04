const pool = require('../db');
const {
    verificarAccessToken,
    crearAccessToken,
    crearRefreshToken,
    hashRefreshToken,
    REFRESH_TOKEN_MAX_AGE
} = require('../services/tokenService');

const OPCIONES_COOKIE = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    path: '/'
};

const limpiarCookies = res => {
    res.clearCookie('jwt', OPCIONES_COOKIE);
    res.clearCookie('refreshToken', OPCIONES_COOKIE);
};

const autenticarAccessToken = async (req, res, next) => {
    const token = req.cookies?.jwt;
    const refreshToken = req.cookies?.refreshToken;

    if (!token && !refreshToken) {
        return res.status(401).json({ error: 'Se requiere sesión activa.' });
    }

    // Intentar verificar el JWT
    let payload = null;
    if (token) {
        try {
            payload = verificarAccessToken(token);
        } catch {
            // JWT expirado o inválido — intentar refrescar
        }
    }

    // Si el JWT es válido, verificar que el refresh token exista en DB
    if (payload) {
        if (!refreshToken) {
            limpiarCookies(res);
            return res.status(401).json({ error: 'La sesión expiró. Inicia sesión nuevamente.' });
        }
        try {
            const resultado = await pool.query(
                `SELECT 1 FROM refresh_tokens WHERE token_hash = $1 AND expira_en > CURRENT_TIMESTAMP`,
                [hashRefreshToken(refreshToken)]
            );
            if (resultado.rowCount === 0) {
                limpiarCookies(res);
                return res.status(401).json({ error: 'La sesión expiró. Inicia sesión nuevamente.' });
            }
        } catch (error) {
            console.error('Error al verificar refresh token:', error);
            return res.status(500).json({ error: 'No se pudo validar la sesión.' });
        }

        const museoId = Number(payload.museo_id);
        if (!Number.isInteger(museoId) || museoId <= 0) {
            limpiarCookies(res);
            return res.status(401).json({ error: 'El token no tiene un museo válido.' });
        }

        req.user = { ...payload, museo_id: museoId };
        return next();
    }

    // JWT inválido/expirado — intentar auto-refresh con el refreshToken
    if (!refreshToken) {
        limpiarCookies(res);
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
            limpiarCookies(res);
            return res.status(401).json({ error: 'La sesión expiró. Inicia sesión nuevamente.' });
        }

        const usuarioResultado = await client.query(
            'SELECT id, rol, museo_id FROM usuarios WHERE id = $1',
            [resultado.rows[0].usuario_id]
        );

        if (usuarioResultado.rowCount === 0) {
            await client.query('ROLLBACK');
            limpiarCookies(res);
            return res.status(401).json({ error: 'La sesión ya no es válida.' });
        }

        const usuario = usuarioResultado.rows[0];

        // Rotar tokens
        const nuevoAccessToken = crearAccessToken(usuario);
        const nuevoRefreshToken = crearRefreshToken();
        const hash = hashRefreshToken(nuevoRefreshToken);
        const expira = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE);

        await client.query(
            `INSERT INTO refresh_tokens (usuario_id, token_hash, expira_en) VALUES ($1, $2, $3)`,
            [usuario.id, hash, expira]
        );

        await client.query('COMMIT');

        // Setear nuevas cookies
        res.cookie('jwt', nuevoAccessToken, { ...OPCIONES_COOKIE, maxAge: 24 * 60 * 60 * 1000 });
        res.cookie('refreshToken', nuevoRefreshToken, { ...OPCIONES_COOKIE, maxAge: REFRESH_TOKEN_MAX_AGE });
        res.setHeader('X-Session-Refreshed', 'true');

        const museoId = Number(usuario.museo_id);
        req.user = { id: usuario.id, rol: usuario.rol, museo_id: museoId };
        return next();
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al refrescar sesión:', error);
        return res.status(500).json({ error: 'No se pudo renovar la sesión.' });
    } finally {
        client.release();
    }
};

module.exports = autenticarAccessToken;
