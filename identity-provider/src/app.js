const express = require('express');
require('dotenv').config();
const app = express();

app.use(express.json());

const authRoutes = require('./routes/auth.routes');
const syncRoutes = require('./routes/sync.routes');

app.use('/api/auth', authRoutes);
app.use('/api/sync', syncRoutes);

// Swagger UI
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/', (req, res) => res.json({ ok: true }));

module.exports = app;
