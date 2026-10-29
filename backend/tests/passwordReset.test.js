const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validarPassword, validarEmail, validarRegistro, normalizarMuseoId } = require('../validators/auth');

test('registro exige museo explícito y rechaza coerciones de tipos', () => {
    for (const museo_id of [undefined, null, '', 0, 3, true, [1], { id: 1 }, '01']) {
        assert.equal(normalizarMuseoId(museo_id), null);
        assert.ok(validarRegistro({ museo_id }).errores.museo_id);
    }
    for (const museo_id of [1, 2, '1', '2']) {
        assert.equal(normalizarMuseoId(museo_id), Number(museo_id));
        assert.equal(validarRegistro({ museo_id }).errores.museo_id, undefined);
    }
});

test('rechaza contraseñas débiles, confirmación distinta y truncamiento bcrypt UTF-8', () => {
    for (const password of ['', null, {}, 'abcd1234', 'ABCD1234', 'Abcdefgh', 'Ab1', `Ab1${'é'.repeat(35)}`]) {
        assert.ok(validarPassword(password, password));
    }
    assert.ok(validarPassword('Segura123', 'Otra1234'));
    assert.equal(validarPassword('Segura123', 'Segura123'), '');
    assert.equal(validarPassword(`Ab1${'é'.repeat(34)}`, `Ab1${'é'.repeat(34)}`), '');
});

test('rechaza emails malformados y tipos inesperados', () => {
    for (const email of [null, {}, '', 'a@', ' a@b.com', 'a@b.com\r\nBcc:x@y.com', `${'a'.repeat(250)}@b.com`]) {
        assert.equal(validarEmail(email), false);
    }
    assert.equal(validarEmail('persona@example.com'), true);
});
