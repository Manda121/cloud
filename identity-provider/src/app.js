const express = require('express');
require('dotenv').config();
const app = express();

// CORS minimal sans dépendance pour éviter d'installer des paquets
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json());

const authRoutes = require('./routes/auth.routes');
const signalementRoutes = require('./routes/signalement.routes');
const syncRoutes = require('./routes/sync.routes');
const notificationRoutes = require('./routes/notification.routes');

app.use('/api/auth', authRoutes);
app.use('/api/signalements', signalementRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/notifications', notificationRoutes);

// Swagger UI
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/', (req, res) => res.json({ ok: true }));

module.exports = app;
