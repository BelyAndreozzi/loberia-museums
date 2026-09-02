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

module.exports = { enviarEmailVerificacion };