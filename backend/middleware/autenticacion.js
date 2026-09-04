const pool = require('../db');
const { verificarAccessToken, hashRefreshToken } = require('../services/tokenService');

const OPCIONES_COOKIE = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    path: '/'
};

const OPCIONES_REFRESH = { ...OPCIONES_COOKIE, path: '/' };

const limpiarCookies = res => {
    res.clearCookie('jwt', OPCIONES_COOKIE);
    res.clearCookie('refreshToken', OPCIONES_REFRESH);
};

const autenticarAccessToken = async (req, res, next) => {
    const token = req.cookies?.jwt;

    if (!token) {
        return res.status(401).json({ error: 'Se requiere un access token válido.' });
    }

    let payload;
    try {
        payload = verificarAccessToken(token);
    } catch {
        limpiarCookies(res);
        return res.status(401).json({ error: 'El access token no es válido o expiró.' });
    }

    const museoId = Number(payload.museo_id);
    if (!Number.isInteger(museoId) || museoId <= 0) {
        limpiarCookies(res);
        return res.status(401).json({ error: 'El token no tiene un museo válido.' });
    }

    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
        limpiarCookies(res);
        return res.status(401).json({ error: 'La sesión expiró. Inicia sesión nuevamente.' });
    }

    try {
        const resultado = await pool.query(
            `SELECT 1 FROM refresh_tokens
             WHERE token_hash = $1 AND expira_en > CURRENT_TIMESTAMP`,
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

    req.user = { ...payload, museo_id: museoId };
    return next();
};

module.exports = autenticarAccessToken;
