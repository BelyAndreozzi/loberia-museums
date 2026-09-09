const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[A-Za-z][A-Za-z0-9_.-]{2,29}$/;

const validarEmail = email => typeof email === 'string' && email.length <= 254 && EMAIL_REGEX.test(email);
const normalizarMuseoId = valor => [1, 2, '1', '2'].includes(valor) ? Number(valor) : null;

const validarPassword = (password, confirmPassword) => {
    if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72
        || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
        return 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número; máximo 72 bytes.';
    }
    if (password !== confirmPassword) return 'Las contraseñas no coinciden.';
    return '';
};

const validarRegistro = (datos = {}) => {
    const username = typeof datos.username === 'string' ? datos.username.trim() : '';
    const email = typeof datos.email === 'string' ? datos.email.trim().toLowerCase() : '';
    const password = typeof datos.password === 'string' ? datos.password : '';
    const confirmPassword = typeof datos.confirmPassword === 'string' ? datos.confirmPassword : '';
    const museoId = normalizarMuseoId(datos.museo_id);
    const errores = {};

    if (!Number.isInteger(museoId) || ![1, 2].includes(museoId)) {
        errores.museo_id = 'Debes seleccionar un museo válido.';
    }

    if (!username) errores.username = 'El username es obligatorio.';
    else if (!USERNAME_REGEX.test(username)) {
        errores.username = 'El username debe tener 3 a 30 caracteres, comenzar con una letra y usar solo letras, números, _, . o -.';
    }

    if (!email) errores.email = 'El email es obligatorio.';
    else if (!EMAIL_REGEX.test(email) || email.length > 254) errores.email = 'El email no tiene un formato válido.';

    if (!password) errores.password = 'La contraseña es obligatoria.';
    else if (validarPassword(password, password)) errores.password = validarPassword(password, password);

    if (!confirmPassword) errores.confirmPassword = 'La confirmación de contraseña es obligatoria.';
    else if (password !== confirmPassword) errores.confirmPassword = 'Las contraseñas no coinciden.';

    return { errores, valores: { username, email, password, museo_id: museoId } };
};

module.exports = { validarRegistro, validarEmail, validarPassword, normalizarMuseoId };
