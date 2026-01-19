const { Pool } = require("pg");

let pool;

function getPool() {
  if (pool) return pool;
  pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
    user: process.env.DB_USER || process.env.POSTGRES_USER || 'auth',
    password: process.env.DB_PASS || process.env.POSTGRES_PASSWORD || 'auth123',
    database: process.env.DB_NAME || process.env.POSTGRES_DB || 'auth_db',
  });
  return pool;
}

module.exports = {
  getPool,
  query: (...args) => getPool().query(...args),
  close: () => pool && pool.end(),
};
