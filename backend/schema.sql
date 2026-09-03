CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    username VARCHAR(30) NOT NULL,
    email VARCHAR(254) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email_verificado BOOLEAN NOT NULL DEFAULT FALSE,
    token_verificacion_hash VARCHAR(64),
    token_verificacion_expira TIMESTAMP,
    fecha_registro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT usuarios_username_formato CHECK (username ~ '^[A-Za-z][A-Za-z0-9_.-]{2,29}$'),
    CONSTRAINT usuarios_email_no_vacio CHECK (length(trim(email)) > 3)
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