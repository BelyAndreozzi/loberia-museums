const crypto = require('crypto');
const pool = require('../db');

// Persistent, atomic limits shared by every server instance. Never store raw email/IP.
const permitirIntento = async (ambito, valor, limite) => {
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET no configurado');
    const clave = crypto.createHmac('sha256', process.env.JWT_SECRET)
        .update(`${ambito}:${valor}`).digest('hex');
    const resultado = await pool.query(
        `INSERT INTO auth_rate_limits (clave, intentos, expira_en)
         VALUES ($1, 1, clock_timestamp() + INTERVAL '15 minutes')
         ON CONFLICT (clave) DO UPDATE SET
            intentos = CASE WHEN auth_rate_limits.expira_en <= clock_timestamp()
                THEN 1 ELSE auth_rate_limits.intentos + 1 END,
            expira_en = CASE WHEN auth_rate_limits.expira_en <= clock_timestamp()
                THEN clock_timestamp() + INTERVAL '15 minutes' ELSE auth_rate_limits.expira_en END
         WHERE auth_rate_limits.expira_en <= clock_timestamp() OR auth_rate_limits.intentos < $2
         RETURNING clave`, [clave, limite]
    );
    return resultado.rowCount > 0;
};

module.exports = { permitirIntento };
