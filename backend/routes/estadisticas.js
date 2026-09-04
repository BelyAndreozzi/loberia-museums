const express = require('express');
const pool = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
    const museoId = req.user.museo_id;

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
