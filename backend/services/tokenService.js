const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Esto es el JWT común, que usará siempre el usuario (para todos los endpoints)
const ACCESS_TOKEN_EXPIRATION = '24h';

// Este refresh lo unico que hará es refrescar el ACCESS, entonces evitamos que si nos
// roban el ACCESS, puedan usarlo para siempre. El refresh token es más seguro,
//  y se guarda en la base de datos
// El access se guarda en la cookie, y el refresh token también.
// 7 dias que aguanta el refersh token
const REFRESH_TOKEN_DAYS = 7;

// Una semana para el refresh token pasado a milisegubndos
const REFRESH_TOKEN_MAX_AGE = REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000;

const getJwtSecret = () => {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET no está configurado.');
    }
    return process.env.JWT_SECRET;
};

const crearAccessToken = ({ id, rol, museo_id }) => jwt.sign(
    { id, rol, museo_id },
    getJwtSecret(),
    { expiresIn: ACCESS_TOKEN_EXPIRATION }
);

const crearRefreshToken = () => crypto.randomBytes(48).toString('hex');

const hashRefreshToken = token => crypto.createHash('sha256').update(token).digest('hex');

const verificarAccessToken = token => jwt.verify(token, getJwtSecret());

module.exports = {
    ACCESS_TOKEN_EXPIRATION,
    REFRESH_TOKEN_MAX_AGE,
    crearAccessToken,
    crearRefreshToken,
    hashRefreshToken,
    verificarAccessToken
};
