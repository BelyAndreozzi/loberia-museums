const express = require('express');
const pool = require('../db');
const { requiereRol } = require('../middleware/autorizacion');

const router = express.Router();
const ACCIONES = ['CREAR', 'EDITAR', 'ELIMINAR'];
const POR_PAGINA = 50;

const enteroOpcional = valor => valor === undefined ? null : Number(valor);

router.get('/', requiereRol('encargado', 'admin'), async (req, res) => {
    const piezaId = enteroOpcional(req.query.pieza_id);
    const antesDe = enteroOpcional(req.query.antes_de);
    const accion = req.query.accion ?? null;

    if ((piezaId !== null && !Number.isInteger(piezaId)) || (antesDe !== null && !Number.isInteger(antesDe))
        || (accion !== null && !ACCIONES.includes(accion))) {
        return res.status(400).json({ error: 'Filtros inválidos.' });
    }

    try {
        // Si la pieza ya no existe, su nombre sale de la última copia guardada (alta o eliminación).
        const resultado = await pool.query(
            `SELECT a.id, a.pieza_id, a.accion, a.detalles, a.fecha, u.username,
                    (p.id IS NOT NULL) AS pieza_existe,
                    COALESCE(p.numero_inventario, copia.datos->>'numero_inventario') AS numero_inventario,
                    COALESCE(p.nombre_designacion, copia.datos->>'nombre_designacion') AS nombre_designacion
             FROM auditoria_piezas a
             JOIN usuarios u ON u.id = a.usuario_id
             LEFT JOIN piezas p ON p.id = a.pieza_id AND p.museo_id = a.museo_id
             LEFT JOIN LATERAL (
                 SELECT s.detalles->'pieza' AS datos
                 FROM auditoria_piezas s
                 WHERE s.pieza_id = a.pieza_id AND s.museo_id = a.museo_id AND s.detalles ? 'pieza'
                 ORDER BY s.id DESC
                 LIMIT 1
             ) copia ON p.id IS NULL
             WHERE a.museo_id = $1
               AND ($2::int IS NULL OR a.pieza_id = $2)
               AND ($3::text IS NULL OR a.accion = $3)
               AND ($4::bigint IS NULL OR a.id < $4)
             ORDER BY a.id DESC
             LIMIT $5`,
            [req.user.museo_id, piezaId, accion, antesDe, POR_PAGINA + 1]
        );

        res.json({
            registros: resultado.rows.slice(0, POR_PAGINA),
            hayMas: resultado.rows.length > POR_PAGINA
        });
    } catch (error) {
        console.error('Error al obtener la auditoría de piezas:', error);
        res.status(500).json({ error: 'No se pudo obtener el historial.' });
    }
});

module.exports = router;
