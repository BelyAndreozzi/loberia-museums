require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const pool = require('./db');
const estadisticasRouter = require('./routes/estadisticas');
const authRouter = require('./routes/auth');
const autenticarAccessToken = require('./middleware/autenticacion');

const app = express();
const port = process.env.PORT || 3000;

// Middlewares
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRouter);
app.use('/api/piezas', autenticarAccessToken);

// Ruta de prueba para verificar la conexión a la base de datos
app.get('/api/test-db', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({
            mensaje: '¡Conexión exitosa a la base de datos!',
            hora_servidor: result.rows[0].now
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Fallo al conectar con la base de datos' });
    }
});

// Ruta POST para crear una nueva pieza
app.post('/api/piezas', async (req, res) => {
    const {
        numero_inventario, nombre_designacion, estado_conservacion, procedencia, // Datos comunes
        categoria, ubicacion_museo, ubicacion_deposito, estanteria, estante, // Exclusivos Cs. Naturales
        material_principal, material_secundario, material_terciario, largo_cm, ancho_cm, espesor_cm, autor, forma_ingreso // Exclusivos Historia
    } = req.body;
    const museoId = req.user.museo_id;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const queryPieza = `
            INSERT INTO piezas (museo_id, numero_inventario, nombre_designacion, estado_conservacion, procedencia)
            VALUES ($1, $2, $3, $4, $5) RETURNING id;
        `;
        const valoresPieza = [museoId, numero_inventario, nombre_designacion, estado_conservacion, procedencia];

        const resultadoPieza = await client.query(queryPieza, valoresPieza);
        const nuevaPiezaId = resultadoPieza.rows[0].id;

        if (museoId === 1) {
            const queryNaturales = `
                INSERT INTO detalles_naturales (pieza_id, categoria, ubicacion_museo, ubicacion_deposito, estanteria, estante)
                VALUES ($1, $2, $3, $4, $5, $6);
            `;
            const valoresNaturales = [nuevaPiezaId, categoria, ubicacion_museo, ubicacion_deposito, estanteria, estante];
            await client.query(queryNaturales, valoresNaturales);

        } else if (museoId === 2) {
            const queryHistoria = `
                INSERT INTO detalles_historia (pieza_id, material_principal, material_secundario, material_terciario, largo_cm, ancho_cm, espesor_cm, autor, forma_ingreso)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
            `;
            const valoresHistoria = [nuevaPiezaId, material_principal, material_secundario, material_terciario, largo_cm, ancho_cm, espesor_cm, autor, forma_ingreso];
            await client.query(queryHistoria, valoresHistoria);
        }

        await client.query('COMMIT');
        res.status(201).json({ mensaje: '¡Pieza guardada con éxito!', pieza_id: nuevaPiezaId });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al guardar la pieza:', error);
        res.status(500).json({ error: 'Fallo al guardar en la base de datos' });
    } finally {
        client.release();
    }
});

app.use('/api/piezas/estadisticas', estadisticasRouter);

// Ruta GET para obtener piezas con filtros dinámicos
app.get('/api/piezas', async (req, res) => {
    // 1. Recibimos los posibles filtros desde el frontend
    const {
        busqueda, // Para palabra clave (nombre, inventario, procedencia)
        estado_conservacion,
        categoria 
    } = req.query;
    const museoId = req.user.museo_id;

    try {
        let query = `
            SELECT p.*, m.nombre as nombre_museo,
                    dn.categoria, dn.ubicacion_museo, dn.ubicacion_deposito,
                    dn.estanteria, dn.estante,
                    dh.material_principal, dh.material_secundario,
                    dh.material_terciario, dh.largo_cm, dh.ancho_cm,
                    dh.espesor_cm, dh.autor, dh.forma_ingreso
            FROM piezas p
            LEFT JOIN museos m ON p.museo_id = m.id
            LEFT JOIN detalles_naturales dn ON p.id = dn.pieza_id
            LEFT JOIN detalles_historia dh ON p.id = dh.pieza_id
            WHERE p.museo_id = $1
        `;

        const params = [museoId];
        let paramCount = 2;

        // Búsqueda general (Palabras clave)
        if (busqueda) {
            query += ` AND (
                unaccent(p.nombre_designacion) ILIKE unaccent($${paramCount}) OR 
                unaccent(p.numero_inventario) ILIKE unaccent($${paramCount}) OR 
                unaccent(p.procedencia) ILIKE unaccent($${paramCount})
            )`;
            params.push(`%${busqueda}%`); 
            paramCount++;
        }

        if (estado_conservacion) {
            query += ` AND p.estado_conservacion = $${paramCount}`;
            params.push(estado_conservacion);
            paramCount++;
        }

        if (categoria) {
            query += ` AND dn.categoria = $${paramCount}`;
            params.push(categoria);
            paramCount++;
        }

        query += ` ORDER BY p.fecha_registro DESC`;

        const result = await pool.query(query, params);
        res.json(result.rows);

    } catch (error) {
        console.error('Error al obtener las piezas:', error);
        res.status(500).json({ error: 'Fallo al obtener los datos' });
    }
});

// Ruta DELETE para eliminar una pieza por su ID
app.delete('/api/piezas/:id', async (req, res) => {
    const { id } = req.params;
    const museoId = req.user.museo_id;

    try {
        await pool.query('BEGIN');

        await pool.query(`
            DELETE FROM detalles_historia
            WHERE pieza_id = $1
                AND EXISTS (SELECT 1 FROM piezas WHERE id = $1 AND museo_id = $2)
        `, [id, museoId]);
        await pool.query(`
            DELETE FROM detalles_naturales
            WHERE pieza_id = $1
                AND EXISTS (SELECT 1 FROM piezas WHERE id = $1 AND museo_id = $2)
        `, [id, museoId]);

        const resultado = await pool.query(
            'DELETE FROM piezas WHERE id = $1 AND museo_id = $2 RETURNING *',
            [id, museoId]
        );

        if (resultado.rowCount === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ error: 'La pieza no existe' });
        }

        await pool.query('COMMIT');
        res.json({ mensaje: 'Pieza eliminada correctamente' });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error al eliminar la pieza:', error);
        res.status(500).json({ error: 'Fallo al eliminar en la base de datos' });
    }
});

// Ruta DELETE masiva para eliminar múltiples piezas
app.delete('/api/piezas', async (req, res) => {
    const { ids } = req.body;
    const museoId = req.user.museo_id;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'No se proporcionaron IDs válidos para eliminar' });
    }

    try {
        await pool.query('BEGIN');

        await pool.query(`
            DELETE FROM detalles_historia
            WHERE pieza_id = ANY($1)
                AND EXISTS (SELECT 1 FROM piezas WHERE piezas.id = detalles_historia.pieza_id AND museo_id = $2)
        `, [ids, museoId]);
        await pool.query(`
            DELETE FROM detalles_naturales
            WHERE pieza_id = ANY($1)
                AND EXISTS (SELECT 1 FROM piezas WHERE piezas.id = detalles_naturales.pieza_id AND museo_id = $2)
        `, [ids, museoId]);

        await pool.query('DELETE FROM piezas WHERE id = ANY($1) AND museo_id = $2', [ids, museoId]);

        await pool.query('COMMIT');
        res.json({ mensaje: 'Piezas eliminadas correctamente' });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error al eliminar múltiples piezas:', error);
        res.status(500).json({ error: 'Fallo al eliminar masivamente en la base de datos' });
    }
});

// Ruta PUT para actualizar una pieza existente
app.put('/api/piezas/:id', async (req, res) => {
    const { id } = req.params;
    const {
        numero_inventario,
        nombre_designacion,
        estado_conservacion,
        procedencia,
        // Campos específicos de cada museo
        categoria,
        ubicacion_museo,
        forma_ingreso,
        material_principal,
        material_secundario,
        largo_cm,
        ancho_cm
    } = req.body;
    const museoId = req.user.museo_id;

    try {
        await pool.query('BEGIN');

        const queryPieza = `
            UPDATE piezas 
            SET numero_inventario = $1, nombre_designacion = $2, estado_conservacion = $3, procedencia = $4
            WHERE id = $5 AND museo_id = $6
        `;
        const resultadoPieza = await pool.query(queryPieza, [numero_inventario, nombre_designacion, estado_conservacion, procedencia, id, museoId]);

        if (resultadoPieza.rowCount === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ error: 'La pieza no existe' });
        }

        if (museoId === 1) {
            await pool.query(`
                UPDATE detalles_naturales 
                SET categoria = $1, ubicacion_museo = $2 
                WHERE pieza_id = $3 AND EXISTS (
                    SELECT 1 FROM piezas WHERE piezas.id = $3 AND piezas.museo_id = $4
                )
            `, [categoria, ubicacion_museo, id, museoId]);
        } else if (museoId === 2) {
            await pool.query(`
                UPDATE detalles_historia 
                SET forma_ingreso = $1, material_principal = $2, material_secundario = $3, largo_cm = $4, ancho_cm = $5 
                WHERE pieza_id = $6 AND EXISTS (
                    SELECT 1 FROM piezas WHERE piezas.id = $6 AND piezas.museo_id = $7
                )
            `, [forma_ingreso, material_principal, material_secundario, largo_cm, ancho_cm, id, museoId]);
        }

        await pool.query('COMMIT');
        res.json({ mensaje: 'Pieza actualizada correctamente' });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error al actualizar la pieza:', error);
        res.status(500).json({ error: 'Fallo al actualizar en la base de datos' });
    }
});

// Levantar servidor
app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});