CREATE EXTENSION IF NOT EXISTS unaccent;
-- Después del esquema base, ejecutar: npm run migrate --prefix backend

CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    username VARCHAR(30) NOT NULL,
    email VARCHAR(254) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(20) NOT NULL DEFAULT 'usuario',
    museo_id INTEGER,
    estado_aprobacion VARCHAR(16) NOT NULL DEFAULT 'pendiente',
    email_verificado BOOLEAN NOT NULL DEFAULT FALSE,
    token_verificacion_hash VARCHAR(64),
    token_verificacion_expira TIMESTAMP,
    fecha_registro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT usuarios_username_formato CHECK (username ~ '^[A-Za-z][A-Za-z0-9_.-]{2,29}$'),
    CONSTRAINT usuarios_email_no_vacio CHECK (length(trim(email)) > 3),
    CONSTRAINT usuarios_rol_valido CHECK (rol IN ('encargado', 'admin', 'usuario')),
    CONSTRAINT usuarios_estado_aprobacion_valido CHECK (estado_aprobacion IN ('pendiente', 'aprobado', 'rechazado'))
);

CREATE UNIQUE INDEX IF NOT EXISTS usuarios_username_unico
    ON usuarios (lower(username));

CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email_unico
    ON usuarios (lower(email));

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email_verificado BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS token_verificacion_hash VARCHAR(64);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS token_verificacion_expira TIMESTAMP;

CREATE TABLE IF NOT EXISTS museos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL
);

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS rol VARCHAR(20) NOT NULL DEFAULT 'usuario';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS museo_id INTEGER;
-- Las cuentas existentes quedan aprobadas; solo las nuevas arrancan pendientes.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS estado_aprobacion VARCHAR(16) NOT NULL DEFAULT 'aprobado';
ALTER TABLE usuarios ALTER COLUMN estado_aprobacion SET DEFAULT 'pendiente';
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_valido;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_valido CHECK (rol IN ('encargado', 'admin', 'usuario'));
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_museo_id_fkey;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_museo_id_fkey FOREIGN KEY (museo_id) REFERENCES museos(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS registro_aprobaciones (
    usuario_id INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expira_en TIMESTAMPTZ NOT NULL,
    decision VARCHAR(16) CHECK (decision IN ('aprobado', 'rechazado')),
    decidido_en TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expira_en TIMESTAMP NOT NULL,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS refresh_tokens_expira_idx ON refresh_tokens (expira_en);

CREATE TABLE IF NOT EXISTS piezas (
    id SERIAL PRIMARY KEY,
    museo_id INTEGER REFERENCES museos(id) ON DELETE CASCADE,
    numero_inventario VARCHAR(50),
    nombre_designacion VARCHAR(255) NOT NULL,
    estado_conservacion VARCHAR(50),
    procedencia TEXT,
    fecha_registro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS detalles_naturales (
    pieza_id INTEGER PRIMARY KEY REFERENCES piezas(id) ON DELETE CASCADE,
    categoria VARCHAR(100),
    ubicacion_museo BOOLEAN NOT NULL DEFAULT FALSE,
    ubicacion_deposito BOOLEAN DEFAULT FALSE,
    estanteria VARCHAR(50),
    estante VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS detalles_historia (
    pieza_id INTEGER PRIMARY KEY REFERENCES piezas(id) ON DELETE CASCADE,
    material_principal VARCHAR(100),
    material_secundario VARCHAR(100),
    material_terciario VARCHAR(100),
    largo_cm NUMERIC(6, 2),
    ancho_cm NUMERIC(6, 2),
    espesor_cm NUMERIC(6, 2),
    autor VARCHAR(150),
    forma_ingreso TEXT
);

INSERT INTO museos (id, nombre)
VALUES
    (1, 'Ciencias Naturales'),
    (2, 'Historia')
ON CONFLICT (id) DO NOTHING;
