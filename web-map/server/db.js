const { Pool } = require('pg');

// Configuration de la connexion PostgreSQL
// Utilise les mêmes credentials que identity-provider
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'auth',
  password: process.env.DB_PASS || 'auth123',
  database: process.env.DB_NAME || 'auth_db',
});

// Test de connexion au démarrage
pool.on('connect', () => {
  console.log('[DB] Connecté à PostgreSQL');
});

pool.on('error', (err) => {
  console.error('[DB] Erreur PostgreSQL:', err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
