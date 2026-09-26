// GET/PATCH /api/alertas — alertas de bajo desempeño para administrador
import { Router } from 'express';
import { getPool, sql } from '../db.js';
import { verificarToken } from '../middleware/verificarToken.js';

const router = Router();
router.use(verificarToken);

const soloAdmin = (req, res, next) =>
  req.usuario.role === 'admin' ? next() : res.status(403).json({ error: 'Solo admin.' });

// GET /api/alertas — lista las 50 alertas más recientes
router.get('/', soloAdmin, async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT TOP 50
        Id_Alerta, Tipo, Mensaje, Datos, Leida, Creacion
      FROM AKR_Alertas_Admin
      ORDER BY Creacion DESC
    `);
    return res.json(result.recordset);
  } catch (err) {
    console.error('GET /alertas:', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

// GET /api/alertas/no-leidas — solo el conteo de alertas sin leer
router.get('/no-leidas', soloAdmin, async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query('SELECT COUNT(*) AS total FROM AKR_Alertas_Admin WHERE Leida = 0');
    return res.json({ total: result.recordset[0].total });
  } catch (err) {
    console.error('GET /alertas/no-leidas:', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

// PATCH /api/alertas/leer-todas — marca todas como leídas
router.patch('/leer-todas', soloAdmin, async (_req, res) => {
  try {
    const pool = await getPool();
    await pool.request().query('UPDATE AKR_Alertas_Admin SET Leida = 1 WHERE Leida = 0');
    return res.json({ ok: true });
  } catch (err) {
    console.error('PATCH /alertas/leer-todas:', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

// PATCH /api/alertas/:id/leer — marca una alerta como leída
router.patch('/:id/leer', soloAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id || isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });
  try {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, id)
      .query('UPDATE AKR_Alertas_Admin SET Leida = 1 WHERE Id_Alerta = @id');
    return res.json({ ok: true });
  } catch (err) {
    console.error('PATCH /alertas/:id/leer:', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

export default router;
