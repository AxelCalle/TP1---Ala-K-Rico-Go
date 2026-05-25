// Módulo de conexión a SQL Server (singleton de pool)
import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

const config = {
  server: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT) || 1433,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

// Instancia única del pool (singleton)
let pool = null;

/**
 * Retorna el pool de conexión activo, creándolo si aún no existe.
 * @returns {Promise<sql.ConnectionPool>}
 */
export async function getPool() {
  if (pool) return pool;

  try {
    pool = await new sql.ConnectionPool(config).connect();
    console.log('Conectado a SQL Server correctamente.');
  } catch (err) {
    console.error('Error al conectar con SQL Server:', err.message);
    throw err;
  }

  return pool;
}

export { sql };
