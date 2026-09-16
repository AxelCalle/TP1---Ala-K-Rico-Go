// Configuración del sistema (ACO y parámetros) — CP073-075 (HU025)
import { Router } from 'express';
import { getPool, sql } from '../db.js';
import { verificarToken } from '../middleware/verificarToken.js';
import { registrarAuditoria } from '../middleware/auditoria.js';

const router = Router();
router.use(verificarToken);

// GET /api/config/aco  — solo admin
router.get('/aco', async (req, res) => {
  if (req.usuario.role !== 'admin') {
    return res.status(403).json({ error: 'Solo admin.' });
  }
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT Clave, Valor FROM AKR_ConfigACO');
    const config = {};
    for (const row of result.recordset) config[row.Clave] = row.Valor;
    return res.json(config);
  } catch (err) {
    console.error('GET /config/aco:', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

// PUT /api/config/aco  — solo admin
router.put('/aco', async (req, res) => {
  if (req.usuario.role !== 'admin') {
    return res.status(403).json({ error: 'Solo admin.' });
  }

  const permitidas = ['alfa','beta','rho','Q','numAnts','iterations','elite','tauMin'];
  // Rangos válidos por parámetro: [min, max]
  const rangos = {
    alfa:       [0.1,  10],
    beta:       [0.1,  10],
    rho:        [0.01,  0.99],
    Q:          [0.1,  10],
    numAnts:    [5,    100],
    iterations: [10,   500],
    elite:      [0,    20],
    tauMin:     [0.001, 1],
  };

  const updates = Object.entries(req.body).filter(([k]) => permitidas.includes(k));

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No hay parámetros válidos.' });
  }

  // Validar valores antes de guardar
  for (const [clave, valor] of updates) {
    const num = parseFloat(valor);
    if (!isFinite(num) || isNaN(num)) {
      return res.status(400).json({ error: `Valor inválido para '${clave}'.` });
    }
    const [min, max] = rangos[clave];
    if (num < min || num > max) {
      return res.status(400).json({ error: `'${clave}' debe estar entre ${min} y ${max}.` });
    }
  }

  try {
    const pool = await getPool();
    for (const [clave, valor] of updates) {
      await pool.request()
        .input('clave', sql.NVarChar(30), clave)
        .input('valor', sql.Float,        parseFloat(valor))
        .query(`
          MERGE AKR_ConfigACO AS t
          USING (SELECT @clave AS Clave) AS s ON t.Clave = s.Clave
          WHEN MATCHED     THEN UPDATE SET Valor = @valor
          WHEN NOT MATCHED THEN INSERT (Clave, Valor) VALUES (@clave, @valor);
        `);
    }

    await registrarAuditoria(pool, req.usuario.id, null, 'config_aco_actualizada',
      `Parámetros actualizados: ${updates.map(([k,v]) => `${k}=${v}`).join(', ')}`, req);

    return res.json({ ok: true });
  } catch (err) {
    console.error('PUT /config/aco:', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

export default router;
