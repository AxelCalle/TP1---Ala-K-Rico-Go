// Log de auditoría — CP055-057 (HU019)
import { Router } from 'express';
import { getPool, sql } from '../db.js';
import { verificarToken } from '../middleware/verificarToken.js';

const router = Router();

// GET /api/auditoria/eventos  — tipos de evento registrados (filtro "Tipo de acción")
router.get('/eventos', verificarToken, async (req, res) => {
  if (req.usuario.role !== 'admin') {
    return res.status(403).json({ error: 'Solo admin.' });
  }
  try {
    const pool = await getPool();
    const r = await pool.request().query('SELECT DISTINCT Evento FROM AKR_Auditoria ORDER BY Evento');
    return res.json(r.recordset.map((f) => f.Evento));
  } catch (err) {
    console.error('GET /auditoria/eventos:', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

// GET /api/auditoria  — solo admin, con filtros opcionales
// evento: tipo exacto · usuario: nombre, apellido o correo (parcial) · desde/hasta: fecha ISO
router.get('/', verificarToken, async (req, res) => {
  if (req.usuario.role !== 'admin') {
    return res.status(403).json({ error: 'Solo admin.' });
  }

  const { evento, desde, hasta, usuario } = req.query;
  const page     = Math.max(parseInt(req.query.page,     10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 50, 1), 200);
  const offset   = (page - 1) * pageSize;

  const parseDate = (val) => {
    if (!val) return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  };

  const fechaDesde = desde ? parseDate(desde) : null;
  const fechaHasta = hasta ? parseDate(hasta) : null;
  if (desde && !fechaDesde) return res.status(400).json({ error: 'Fecha "desde" inválida.' });
  if (hasta && !fechaHasta) return res.status(400).json({ error: 'Fecha "hasta" inválida.' });

  try {
    const pool = await getPool();
    const dataReq  = pool.request()
      .input('offset',   sql.Int, offset)
      .input('pageSize', sql.Int, pageSize);
    const countReq = pool.request();

    let where = '1=1';
    if (evento) {
      const eventoSafe = String(evento).slice(0, 60);
      dataReq.input('evento',  sql.NVarChar(60), eventoSafe);
      countReq.input('evento', sql.NVarChar(60), eventoSafe);
      where += ' AND a.Evento = @evento';
    }
    if (usuario && String(usuario).trim()) {
      // Búsqueda parcial: se escapan los comodines de LIKE del texto ingresado
      const patron = `%${String(usuario).trim().slice(0, 100).replace(/[\%_[]/g, '[$&]')}%`;
      dataReq.input('usuario',  sql.NVarChar(110), patron);
      countReq.input('usuario', sql.NVarChar(110), patron);
      where += ` AND (u.Nombre_Usuario LIKE @usuario OR u.Apellido_Usuario LIKE @usuario
                 OR u.Email_Usuario LIKE @usuario OR a.Email_Intento LIKE @usuario
                 OR CONCAT(u.Nombre_Usuario, ' ', u.Apellido_Usuario) LIKE @usuario)`;
    }
    if (fechaDesde) {
      dataReq.input('desde',  sql.DateTime, fechaDesde);
      countReq.input('desde', sql.DateTime, fechaDesde);
      where += ' AND a.Timestamp >= @desde';
    }
    if (fechaHasta) {
      dataReq.input('hasta',  sql.DateTime, fechaHasta);
      countReq.input('hasta', sql.DateTime, fechaHasta);
      where += ' AND a.Timestamp <= @hasta';
    }

    const [dataResult, countResult] = await Promise.all([
      dataReq.query(`
        SELECT
          a.Id_Log, a.Id_Usuario, a.Email_Intento, a.Evento,
          a.Detalle, a.IP, a.Timestamp,
          u.Nombre_Usuario, u.Apellido_Usuario, u.Email_Usuario
        FROM AKR_Auditoria a
        LEFT JOIN AKR_Usuarios u ON a.Id_Usuario = u.Id_Usuario
        WHERE ${where}
        ORDER BY a.Timestamp DESC
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
      `),
      countReq.query(`SELECT COUNT(*) AS total FROM AKR_Auditoria a
                      LEFT JOIN AKR_Usuarios u ON a.Id_Usuario = u.Id_Usuario
                      WHERE ${where}`),
    ]);

    const totalItems = countResult.recordset[0].total;
    return res.json({
      items:      dataResult.recordset,
      page,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
    });
  } catch (err) {
    console.error('GET /auditoria:', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

export default router;
