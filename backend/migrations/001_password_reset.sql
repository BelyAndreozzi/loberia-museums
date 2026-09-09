ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    usuario_id INTEGER PRIMARY KEY REFERENCES usuarios(id),
    email VARCHAR(254) NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expira_en TIMESTAMPTZ NOT NULL,
    consumido_en TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth_rate_limits (
    clave VARCHAR(64) PRIMARY KEY,
    intentos INTEGER NOT NULL,
    expira_en TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS password_reset_audit (
    id BIGSERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    museo_id INTEGER,
    evento VARCHAR(32) NOT NULL CHECK (evento IN ('solicitado', 'restablecido', 'envio_fallido')),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
