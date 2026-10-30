CREATE TABLE IF NOT EXISTS museos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL
);

INSERT INTO museos (id, nombre)
VALUES (1, 'Ciencias Naturales'), (2, 'Historia')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS museo_id INTEGER;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS rol VARCHAR(20) NOT NULL DEFAULT 'usuario';
-- Existing accounts predate approval workflow; preserve their access.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS estado_aprobacion VARCHAR(16) NOT NULL DEFAULT 'aprobado';

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_valido;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_valido
    CHECK (rol IN ('encargado', 'admin', 'usuario'));
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_estado_aprobacion_valido;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_estado_aprobacion_valido
    CHECK (estado_aprobacion IN ('pendiente', 'aprobado', 'rechazado'));
ALTER TABLE usuarios ALTER COLUMN estado_aprobacion SET DEFAULT 'pendiente';
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_museo_id_fkey;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_museo_id_fkey
    FOREIGN KEY (museo_id) REFERENCES museos(id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS registro_aprobaciones (
    usuario_id INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expira_en TIMESTAMPTZ NOT NULL,
    decision VARCHAR(16) CHECK (decision IN ('aprobado', 'rechazado')),
    decidido_en TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS usuarios_encargados_museo_idx
    ON usuarios (museo_id, rol) WHERE rol = 'encargado';
CREATE INDEX IF NOT EXISTS registro_aprobaciones_expira_idx
    ON registro_aprobaciones (expira_en);
