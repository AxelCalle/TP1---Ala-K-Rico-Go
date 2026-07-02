// Caché de geocodificación con TTL — CP049-051 (HU017)
import { Router } from 'express';
import crypto from 'crypto';
import { getPool, sql } from '../db.js';
import { verificarToken } from '../middleware/verificarToken.js';

const router = Router();
router.use(verificarToken);

const TTL_HORAS = 24;

function hashQuery(query) {
  return crypto.createHash('sha256').update(query.trim().toLowerCase()).digest('hex');
}

// GET /api/geocache?q=<texto>
router.get('/', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Parámetro q requerido.' });

  try {
    const pool  = await getPool();
    const hash  = hashQuery(q);
    const now   = new Date();

    const result = await pool.request()
      .input('hash', sql.NVarChar(64), hash)
      .input('now',  sql.DateTime,     now)
      .query(`
        SELECT Lat, Lng, Resultado
        FROM AKR_Geocache
        WHERE Query_Hash = @hash AND Expiracion > @now
      `);

    if (result.recordset[0]) {
      return res.json({ cached: true, ...result.recordset[0] });
    }
    return res.status(404).json({ cached: false });
  } catch (err) {
    console.error('GET /geocache:', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

// POST /api/geocache  — guardar resultado de geocodificación
router.post('/', async (req, res) => {
  const { query, lat, lng, resultado } = req.body;
  if (!query || lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'query, lat y lng son obligatorios.' });
  }

  try {
    const pool       = await getPool();
    const hash       = hashQuery(query);
    const expiracion = new Date(Date.now() + TTL_HORAS * 60 * 60 * 1000);

    await pool.request()
      .input('hash',     sql.NVarChar(64),       hash)
      .input('query',    sql.NVarChar(300),       query)
      .input('lat',      sql.Float,               lat)
      .input('lng',      sql.Float,               lng)
      .input('result',   sql.NVarChar(sql.MAX),   resultado ? JSON.stringify(resultado) : null)
      .input('exp',      sql.DateTime,            expiracion)
      .query(`
        MERGE AKR_Geocache AS target
        USING (SELECT @hash AS Query_Hash) AS source
          ON target.Query_Hash = source.Query_Hash
        WHEN MATCHED THEN
          UPDATE SET Lat = @lat, Lng = @lng, Resultado = @result,
                     Creacion = GETDATE(), Expiracion = @exp
        WHEN NOT MATCHED THEN
          INSERT (Query_Hash, Query_Original, Lat, Lng, Resultado, Expiracion)
          VALUES (@hash, @query, @lat, @lng, @result, @exp);
      `);

    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error('POST /geocache:', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

export default router;
