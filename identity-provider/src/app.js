const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();

// Configuration CORS pour permettre les requêtes cross-origin
app.use(cors({
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  origin: ['http://localhost:3001', 'http://localhost:3002', 'http://localhost', 'http://127.0.0.1:3001', 'http://127.0.0.1:3002', 'http://localhost:5173', 'http://127.0.0.1:5173']
}));

app.use(express.json());

const authRoutes = require('./routes/auth.routes');
const syncRoutes = require('./routes/sync.routes');
const signalementRoutes = require('./routes/signalements.routes');

app.use('/api/auth', authRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/signalements', signalementRoutes);

// Swagger UI
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/', (req, res) => res.json({ ok: true }));

// Expose les fichiers uploadés (photos) statiquement
const path = require('path');
const fs = require('fs');
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

module.exports = app;
