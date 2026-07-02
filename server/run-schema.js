import dotenv from 'dotenv';
import sql from 'mssql';
import fs from 'fs';

dotenv.config();

const config = {
  server: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT) || 1433,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: { encrypt: false, trustServerCertificate: true },
};

try {
  const pool = await new sql.ConnectionPool(config).connect();
  console.log('Conectado a SQL Server correctamente.');

  const schema = fs.readFileSync('./schema.sql', 'utf8');
  const statements = schema
    .split(/\n(?=IF\s|INSERT\s)/i)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  let ok = 0, errores = 0;
  for (let stmt of statements) {
    try {
      // Para bloques que insertan en AKR_Roles con Id explícito,
      // envolver con IDENTITY_INSERT en la misma batch
      if (/INSERT INTO AKR_Roles/i.test(stmt)) {
        stmt = `SET IDENTITY_INSERT AKR_Roles ON;\n${stmt};\nSET IDENTITY_INSERT AKR_Roles OFF;`;
      }
      await pool.request().query(stmt);
      ok++;
    } catch(e) {
      console.error('Error:', e.message.substring(0, 150));
      errores++;
    }
  }
  console.log(`Schema aplicado: ${ok} OK, ${errores} errores de ${statements.length} bloques.`);

  // Verificar datos semilla en AKR_Roles
  const roles = await pool.request().query('SELECT Id_Role, Nombre_Role FROM AKR_Roles ORDER BY Id_Role');
  console.log('Roles:', roles.recordset.map(r => `${r.Id_Role}=${r.Nombre_Role}`).join(', '));

  // Verificar tablas
  const tablas = await pool.request().query(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME LIKE 'AKR_%'
    ORDER BY TABLE_NAME
  `);
  console.log('Tablas:', tablas.recordset.map(r => r.TABLE_NAME).join(', '));

  await pool.close();
} catch(err) {
  console.error('Error de conexion:', err.message);
  process.exit(1);
}
