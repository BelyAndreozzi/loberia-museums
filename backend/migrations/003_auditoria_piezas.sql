-- Registro de quién creó, editó o eliminó cada pieza.
-- pieza_id no tiene FK a piezas: el registro tiene que sobrevivir a la eliminación de la pieza.
-- museo_id permite consultar el historial por museo aunque la pieza ya no exista.
CREATE TABLE IF NOT EXISTS auditoria_piezas (
    id BIGSERIAL PRIMARY KEY,
    pieza_id INTEGER NOT NULL,
    museo_id INTEGER NOT NULL REFERENCES museos(id),
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    accion VARCHAR(10) NOT NULL CHECK (accion IN ('CREAR', 'EDITAR', 'ELIMINAR')),
    detalles JSONB NOT NULL DEFAULT '{}'::jsonb,
    fecha TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS auditoria_piezas_pieza_idx ON auditoria_piezas (pieza_id, fecha DESC);
CREATE INDEX IF NOT EXISTS auditoria_piezas_museo_idx ON auditoria_piezas (museo_id, fecha DESC);
