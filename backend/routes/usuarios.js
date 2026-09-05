const express = require('express');
const pool = require('../db');
const { requiereRol } = require('../middleware/autorizacion');

const router = express.Router();

router.use(requiereRol('encargado', 'admin'));

router.get('/', async (req, res) => {
    try {
        const resultado = await pool.query(
            `SELECT u.id, u.username, u.email, u.rol, u.museo_id, u.fecha_registro,
                    m.nombre AS museo_nombre
             FROM usuarios u
             LEFT JOIN museos m ON u.museo_id = m.id
             ORDER BY u.fecha_registro DESC`
        );
        res.json(resultado.rows);
    } catch (error) {
        console.error('Error al listar usuarios:', error);
        res.status(500).json({ error: 'No se pudieron obtener los usuarios.' });
    }
});

router.put('/:id/rol', async (req, res) => {
    const { id } = req.params;
    const { rol } = req.body;
    const rolesValidos = ['admin', 'usuario'];

    if (!rolesValidos.includes(rol)) {
        return res.status(400).json({ error: `Rol inválido. Roles permitidos: ${rolesValidos.join(', ')}` });
    }

    if (req.user.rol !== 'encargado') {
        return res.status(403).json({ error: 'Solo el encargado puede asignar roles.' });
    }

    const userId = Number(id);
    if (userId === req.user.id) {
        return res.status(400).json({ error: 'No podés cambiar tu propio rol.' });
    }

    try {
        const resultado = await pool.query(
            `UPDATE usuarios SET rol = $1 WHERE id = $2 RETURNING id, username, email, rol, museo_id`,
            [rol, userId]
        );

        if (resultado.rowCount === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        res.json({ mensaje: 'Rol actualizado correctamente.', usuario: resultado.rows[0] });
    } catch (error) {
        console.error('Error al actualizar rol:', error);
        res.status(500).json({ error: 'No se pudo actualizar el rol.' });
    }
});

module.exports = router;
