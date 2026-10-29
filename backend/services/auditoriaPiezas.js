const CAMPOS_PIEZA = ['numero_inventario', 'nombre_designacion', 'estado_conservacion', 'procedencia'];
const CAMPOS_DETALLE = {
    1: ['categoria', 'ubicacion_museo', 'ubicacion_deposito', 'estanteria', 'estante'],
    2: ['material_principal', 'material_secundario', 'material_terciario', 'largo_cm', 'ancho_cm', 'espesor_cm', 'autor', 'forma_ingreso']
};

// Devuelve el estado actual de las piezas (con sus detalles) y las bloquea hasta el fin de la transacción.
const obtenerPiezas = async (client, ids, museoId) => {
    const resultado = await client.query(
        `SELECT p.id, p.museo_id, p.numero_inventario, p.nombre_designacion, p.estado_conservacion, p.procedencia,
                dn.categoria, dn.ubicacion_museo, dn.ubicacion_deposito, dn.estanteria, dn.estante,
                dh.material_principal, dh.material_secundario, dh.material_terciario,
                dh.largo_cm, dh.ancho_cm, dh.espesor_cm, dh.autor, dh.forma_ingreso
         FROM piezas p
         LEFT JOIN detalles_naturales dn ON dn.pieza_id = p.id
         LEFT JOIN detalles_historia dh ON dh.pieza_id = p.id
         WHERE p.id = ANY($1::int[]) AND p.museo_id = $2
         ORDER BY p.id
         FOR UPDATE OF p`,
        [ids, museoId]
    );
    return resultado.rows.map(fila => ({
        id: fila.id,
        datos: Object.fromEntries([...CAMPOS_PIEZA, ...(CAMPOS_DETALLE[museoId] || [])].map(campo => [campo, fila[campo]]))
    }));
};

const calcularCambios = (antes, despues) => Object.fromEntries(
    Object.keys(despues)
        .filter(campo => antes[campo] !== despues[campo])
        .map(campo => [campo, { antes: antes[campo], despues: despues[campo] }])
);

// usuarioId debe venir siempre de req.user (sesión verificada en el servidor), nunca del body.
const registrarAuditoria = (client, { piezaId, museoId, usuarioId, accion, detalles }) => client.query(
    `INSERT INTO auditoria_piezas (pieza_id, museo_id, usuario_id, accion, detalles)
     VALUES ($1, $2, $3, $4, $5)`,
    [piezaId, museoId, usuarioId, accion, JSON.stringify(detalles)]
);

module.exports = { obtenerPiezas, calcularCambios, registrarAuditoria };
