const { permitirIntento } = require('../services/rateLimitService');
const { validarEmail } = require('../validators/auth');

const crearLimiteAuth = (ambito, limiteIp, limiteEmail) => async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    try {
        // IP comes from the connection; never read forwarding headers directly.
        const permitidoIp = await permitirIntento(`${ambito}-ip`, req.ip, limiteIp);
        const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
        const permitidoEmail = permitidoIp && (!validarEmail(email)
            || await permitirIntento(`${ambito}-email`, email, limiteEmail));
        if (!permitidoIp || !permitidoEmail) {
            res.set('Retry-After', '900');
            return res.status(429).json({ error: 'Demasiados intentos. Probá en 15 minutos.' });
        }
        return next();
    } catch {
        // Fail closed before password hashing, session issuance or email delivery.
        console.error('No se pudo verificar el límite de autenticación.');
        return res.status(503).json({ error: 'No se pudo procesar la solicitud. Intentá nuevamente.' });
    }
};

module.exports = {
    limitarLogin: crearLimiteAuth('login', 20, 5),
    limitarRegistro: crearLimiteAuth('register', 5, 3),
};
