const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();

// Configuration CORS pour permettre les requêtes cross-origin
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:3002', 'http://localhost', 'http://127.0.0.1:3001', 'http://127.0.0.1:3002'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

const authRoutes = require('./routes/auth.routes');

app.use('/api/auth', authRoutes);

// Swagger UI
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/', (req, res) => res.json({ ok: true }));

module.exports = app;
