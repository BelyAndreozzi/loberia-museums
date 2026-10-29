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

const obtenerOrigenFrontend = () => {
    if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL) {
        throw new Error('FRONTEND_URL no configurado');
    }
    const origen = new URL(process.env.FRONTEND_URL || 'http://localhost:5173');
    if (origen.username || origen.password || origen.pathname !== '/' || origen.search || origen.hash
        || !['http:', 'https:'].includes(origen.protocol)
        || (process.env.NODE_ENV === 'production' && origen.protocol !== 'https:')) {
        throw new Error('FRONTEND_URL inválido');
    }
    return origen;
};

const enviarEmailRecuperacion = async (email, token) => {
    const enlace = new URL('/restablecer-password', obtenerOrigenFrontend());
    // Fragments never reach HTTP access logs or Referer headers.
    enlace.hash = new URLSearchParams({ email: email.trim().toLowerCase(), token }).toString();
    await obtenerTransporter().sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: 'Restablecer contraseña - Museos Lobería',
        text: `Para crear una nueva contraseña, abrí este enlace: ${enlace.toString()}\n\nVence en 30 minutos y se puede usar una sola vez. Si no lo solicitaste, ignorá este correo. Tu contraseña no cambió.`
    });
};

const enviarEmailAprobacionRegistro = async ({ destinatario, username, email, museo, token, diasValidez }) => {
    const enlace = new URL('/aprobar-registro', obtenerOrigenFrontend());
    // Fragments never reach HTTP access logs or Referer headers.
    enlace.hash = new URLSearchParams({ token }).toString();

    // Modo desarrollo: el enlace se muestra en consola en lugar de enviarse por email.
    if (process.env.APROBACIONES_POR_CONSOLA === 'true') {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('APROBACIONES_POR_CONSOLA no está permitido en producción.');
        }
        console.log(`\n[Aprobación pendiente] ${museo}: ${username} <${email}> (encargado: ${destinatario})\n${enlace.toString()}\n`);
        return;
    }

    await obtenerTransporter().sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: destinatario,
        subject: `Nueva solicitud de registro - ${museo}`,
        text: `Hay una solicitud de registro pendiente para ${museo}.\n\nUsuario: ${username}\nEmail: ${email}\n\nAbrí este enlace para aprobar o rechazar la solicitud: ${enlace.toString()}\n\nEl enlace vence en ${diasValidez} días y se puede usar una sola vez. No reenvíes este correo.`
    });
};

module.exports = { enviarEmailVerificacion, enviarEmailRecuperacion, enviarEmailAprobacionRegistro };
