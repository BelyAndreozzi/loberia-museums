const nodemailer = require('nodemailer');

const obtenerTransporter = () => {
    const puerto = Number(process.env.SMTP_PORT || 587);

    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
        throw new Error('Falta configurar SMTP_HOST, SMTP_USER o SMTP_PASSWORD.');
    }

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: puerto,
        secure: puerto === 465,
        requireTLS: true,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD
        }
    });
};

const enviarEmailVerificacion = async (email, token) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const enlace = `${frontendUrl}/verificar-email?token=${encodeURIComponent(token)}`;

    await obtenerTransporter().sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: 'Verifica tu email - Museos Lobería',
        text: `Verifica tu cuenta de Museos Lobería abriendo este enlace: ${enlace}`
    });
};

const enviarEmailRecuperacion = async (email, token) => {
    if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL) {
        throw new Error('FRONTEND_URL no configurado');
    }
    const origen = new URL(process.env.FRONTEND_URL || 'http://localhost:5173');
    if (origen.username || origen.password || origen.pathname !== '/' || origen.search || origen.hash
        || !['http:', 'https:'].includes(origen.protocol)
        || (process.env.NODE_ENV === 'production' && origen.protocol !== 'https:')) {
        throw new Error('FRONTEND_URL inválido');
    }
    const enlace = new URL('/restablecer-password', origen);
    // Fragments never reach HTTP access logs or Referer headers.
    enlace.hash = new URLSearchParams({ email: email.trim().toLowerCase(), token }).toString();
    await obtenerTransporter().sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: 'Restablecer contraseña - Museos Lobería',
        text: `Para crear una nueva contraseña, abrí este enlace: ${enlace.toString()}\n\nVence en 30 minutos y se puede usar una sola vez. Si no lo solicitaste, ignorá este correo. Tu contraseña no cambió.`
    });
};

module.exports = { enviarEmailVerificacion, enviarEmailRecuperacion };
