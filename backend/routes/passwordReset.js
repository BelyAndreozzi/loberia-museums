const express = require('express');
const { validarEmail, validarPassword } = require('../validators/auth');
const { permitirIntento, solicitarRecuperacion, restablecerPassword } = require('../services/passwordResetService');

const router = express.Router();
const MENSAJE = 'Si el email corresponde a una cuenta verificada, recibirás un enlace para restablecer tu contraseña.';

router.use(['/forgot-password', '/reset-password'], (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('Referrer-Policy', 'no-referrer');
    // JSON + exact configured origin prevents browser cross-site form submissions.
    const origen = process.env.FRONTEND_URL || (process.env.NODE_ENV !== 'production' ? 'http://localhost:5173' : '');
    if (!origen || (req.get('Origin') && req.get('Origin') !== origen) || !req.is('application/json')) {
        return res.status(403).json({ error: 'Solicitud no permitida.' });
    }
    next();
});

router.post('/forgot-password', async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!validarEmail(email)) return res.status(400).json({ error: 'Ingresá un email válido.' });
    try {
        if (!await permitirIntento('forgot-ip', req.ip, 10)) {
            res.set('Retry-After', '900');
            return res.status(429).json({ error: 'Demasiados intentos. Probá en 15 minutos.' });
        }
        // Reply before account lookup/SMTP: existence and delivery failures are not observable.
        res.json({ mensaje: MENSAJE });
        await solicitarRecuperacion(email);
    } catch {
        console.error('No se pudo procesar la recuperación de contraseña.');
        if (!res.headersSent) res.status(503).json({ error: 'No se pudo procesar la solicitud. Intentá nuevamente.' });
    }
});

router.post('/reset-password', async (req, res) => {
    const datos = req.body || {};
    const email = typeof datos.email === 'string' ? datos.email.trim().toLowerCase() : '';
    const token = typeof datos.token === 'string' ? datos.token : '';
    if (!validarEmail(email) || !/^[a-f0-9]{64}$/.test(token)) {
        return res.status(400).json({ error: 'El enlace no es válido o ya expiró. Solicitá uno nuevo.' });
    }
    const errorPassword = validarPassword(datos.password, datos.confirmPassword);
    if (errorPassword) return res.status(400).json({ error: errorPassword });
    try {
        if (!await permitirIntento('reset-ip', req.ip, 20)
            || !await permitirIntento('reset-token', token, 5)) {
            res.set('Retry-After', '900');
            return res.status(429).json({ error: 'Demasiados intentos. Probá en 15 minutos.' });
        }
        if (!await restablecerPassword({ email, token, password: datos.password })) {
            return res.status(400).json({ error: 'El enlace no es válido o ya expiró. Solicitá uno nuevo.' });
        }
        return res.json({ mensaje: 'Contraseña actualizada. Las sesiones anteriores quedaron cerradas. Iniciá sesión con tu nueva contraseña.' });
    } catch {
        console.error('No se pudo restablecer la contraseña.');
        return res.status(503).json({ error: 'No se pudo cambiar la contraseña. Intentá nuevamente.' });
    }
});

module.exports = router;
