// Log de auditoría — CP055-057 (HU019)
import { Router } from 'express';
import { getPool, sql } from '../db.js';
import { verificarToken } from '../middleware/verificarToken.js';

const router = Router();

// GET /api/auditoria  — solo admin, con filtros opcionales
router.get('/', verificarToken, async (req, res) => {
  if (req.usuario.role !== 'admin') {
    return res.status(403).json({ error: 'Solo admin.' });
  }

  const { evento, desde, hasta, limite = 100 } = req.query;

  try {
    const pool = await getPool();
    const req2 = pool.request()
      .input('limite', sql.Int, Math.min(parseInt(limite) || 100, 500));

    let where = '1=1';
    if (evento) {
      req2.input('evento', sql.NVarChar(60), evento);
      where += ' AND Evento = @evento';
    }
    if (desde) {
      req2.input('desde', sql.DateTime, new Date(desde));
      where += ' AND Timestamp >= @desde';
    }
    if (hasta) {
      req2.input('hasta', sql.DateTime, new Date(hasta));
      where += ' AND Timestamp <= @hasta';
    }

    const result = await req2.query(`
      SELECT TOP (@limite)
        a.Id_Log, a.Id_Usuario, a.Email_Intento, a.Evento,
        a.Detalle, a.IP, a.Timestamp,
        u.Nombre_Usuario, u.Email_Usuario
      FROM AKR_Auditoria a
      LEFT JOIN AKR_Usuarios u ON a.Id_Usuario = u.Id_Usuario
      WHERE ${where}
      ORDER BY a.Timestamp DESC
    `);

    return res.json(result.recordset);
  } catch (err) {
    console.error('GET /auditoria:', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

export default router;
