// Rutas de notificaciones del cliente
import { Router } from 'express';
import { getPool, sql } from '../db.js';
import { verificarToken } from '../middleware/verificarToken.js';

const router = Router();
router.use(verificarToken);

// GET /api/notificaciones  — notificaciones del cliente autenticado
router.get('/', async (req, res) => {
  if (req.usuario.role !== 'customer') {
    return res.status(403).json({ error: 'Solo clientes.' });
  }
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.usuario.id)
      .query(`
        SELECT TOP 50
          Id_Notificacion, Tipo, Mensaje, Id_Pedido, Leida, Creacion
        FROM AKR_Notificaciones
        WHERE Id_Cliente = @id
        ORDER BY Creacion DESC
      `);
    return res.json(result.recordset);
  } catch (err) {
    console.error('GET /notificaciones:', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

// PATCH /api/notificaciones/leer-todas  — marcar todas como leídas
router.patch('/leer-todas', async (req, res) => {
  if (req.usuario.role !== 'customer') {
    return res.status(403).json({ error: 'Solo clientes.' });
  }
  try {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, req.usuario.id)
      .query(`
        UPDATE AKR_Notificaciones SET Leida = 1
        WHERE Id_Cliente = @id AND Leida = 0
      `);
    return res.json({ ok: true });
  } catch (err) {
    console.error('PATCH /notificaciones/leer-todas:', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

// PATCH /api/notificaciones/:id/leer
router.patch('/:id/leer', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request()
      .input('id',  sql.Int, parseInt(req.params.id))
      .input('uid', sql.Int, req.usuario.id)
      .query(`
        UPDATE AKR_Notificaciones SET Leida = 1
        WHERE Id_Notificacion = @id AND Id_Cliente = @uid
      `);
    return res.json({ ok: true });
  } catch (err) {
    console.error('PATCH /notificaciones/:id/leer:', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

export default router;
