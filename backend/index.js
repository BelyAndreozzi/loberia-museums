require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();
const port = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

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
    // 1. Extraemos todos los datos que nos va a mandar el frontend
    const {
        museo_id, numero_inventario, nombre_designacion, estado_conservacion, procedencia, // Datos comunes
        categoria, ubicacion_museo, ubicacion_deposito, estanteria, estante, // Exclusivos Cs. Naturales
        material_principal, material_secundario, material_terciario, largo_cm, ancho_cm, espesor_cm, autor, forma_ingreso // Exclusivos Historia
    } = req.body;

    const client = await pool.connect();

    try {
        await client.query('BEGIN'); 

        // 2. Insertamos primero en la tabla central (piezas)
        const queryPieza = `
            INSERT INTO piezas (museo_id, numero_inventario, nombre_designacion, estado_conservacion, procedencia)
            VALUES ($1, $2, $3, $4, $5) RETURNING id;
        `;
        const valoresPieza = [museo_id, numero_inventario, nombre_designacion, estado_conservacion, procedencia];
        
        const resultadoPieza = await client.query(queryPieza, valoresPieza);
        const nuevaPiezaId = resultadoPieza.rows[0].id; 

        // 3. Insertamos en la tabla satélite correspondiente
        if (museo_id === 1) {
            const queryNaturales = `
                INSERT INTO detalles_naturales (pieza_id, categoria, ubicacion_museo, ubicacion_deposito, estanteria, estante)
                VALUES ($1, $2, $3, $4, $5, $6);
            `;
            const valoresNaturales = [nuevaPiezaId, categoria, ubicacion_museo, ubicacion_deposito, estanteria, estante];
            await client.query(queryNaturales, valoresNaturales);

        } else if (museo_id === 2) {
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

// Ruta GET para obtener piezas (con filtro opcional por museo)
app.get('/api/piezas', async (req, res) => {
    // Capturamos el museo_id si viene por la URL (ej: /api/piezas?museo_id=2)
    const { museo_id } = req.query; 

    try {
        let query = `
            SELECT 
                p.*, 
                m.nombre as nombre_museo,
                dn.categoria, dn.ubicacion_museo, dn.ubicacion_deposito, dn.estanteria, dn.estante,
                dh.material_principal, dh.material_secundario, dh.material_terciario, dh.largo_cm, dh.ancho_cm, dh.espesor_cm, dh.autor, dh.forma_ingreso
            FROM piezas p
            JOIN museos m ON p.museo_id = m.id
            LEFT JOIN detalles_naturales dn ON p.id = dn.pieza_id
            LEFT JOIN detalles_historia dh ON p.id = dh.pieza_id
        `;
        
        const queryParams = [];

        // Si nos pasaron un museo_id, agregamos el WHERE dinámicamente
        if (museo_id) {
            query += ` WHERE p.museo_id = $1`;
            queryParams.push(museo_id);
        }

        query += ` ORDER BY p.fecha_registro DESC;`;

        const result = await pool.query(query, queryParams);
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener piezas:', error);
        res.status(500).json({ error: 'Fallo al traer los datos de la base' });
    }
});

// Levantar servidor
app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});