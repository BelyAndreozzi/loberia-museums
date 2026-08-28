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

// Levantar servidor
app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});