const express = require('express');
const pool = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
    const museoId = Number(req.query.museo_id);

    if (!Number.isInteger(museoId) || museoId <= 0) {
        return res.status(400).json({ error: 'Se requiere un museo_id válido' });
    }

    try {
        const [totalResult, estadosResult, recientesResult] = await Promise.all([
            pool.query(
                'SELECT COUNT(*)::int AS total FROM piezas WHERE museo_id = $1',
                [museoId]
            ),
            pool.query(
                `SELECT estado_conservacion, COUNT(*)::int AS cantidad
                 FROM piezas
                 WHERE museo_id = $1
                 GROUP BY estado_conservacion
                 ORDER BY estado_conservacion`,
                [museoId]
            ),
            pool.query(
                `SELECT COUNT(*)::int AS cantidad
                 FROM piezas
                 WHERE museo_id = $1
                   AND fecha_registro >= NOW() - INTERVAL '30 days'`,
                [museoId]
            )
        ]);

        const porEstado = estadosResult.rows.reduce((estadisticas, fila) => {
            estadisticas[fila.estado_conservacion] = fila.cantidad;
            return estadisticas;
        }, {});

        res.json({
            total: totalResult.rows[0].total,
            porEstado,
            ingresadasRecientemente: recientesResult.rows[0].cantidad,
            periodoRecientesDias: 30
        });
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({ error: 'Fallo al obtener las estadísticas' });
    }
});

module.exports = router;
