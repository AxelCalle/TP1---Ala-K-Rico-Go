// Reportes y estadísticas — CP076-087 (HU026-029)
import { Router } from 'express';
import { getPool, sql } from '../db.js';
import { verificarToken } from '../middleware/verificarToken.js';

const router = Router();
router.use(verificarToken);

function soloAdmin(req, res, next) {
  if (req.usuario.role !== 'admin') {
    return res.status(403).json({ error: 'Solo admin.' });
  }
  next();
}

// GET /api/reportes/dashboard  — KPIs del día (CP088-090)
router.get('/dashboard', soloAdmin, async (req, res) => {
  try {
    const pool = await getPool();

    const [kpis, porEstado, recientes] = await Promise.all([
      pool.request().query(`
        SELECT
          COUNT(*)                                                AS total_hoy,
          SUM(CASE WHEN Estado NOT IN ('entregado','cancelado')
                   THEN 1 ELSE 0 END)                           AS activos,
          SUM(CASE WHEN Estado = 'entregado' THEN 1 ELSE 0 END) AS entregados,
          SUM(CASE WHEN Estado = 'cancelado' THEN 1 ELSE 0 END) AS cancelados,
          AVG(CASE WHEN Entrega_Pedido IS NOT NULL AND Asignacion_Pedido IS NOT NULL
                   THEN DATEDIFF(MINUTE, Asignacion_Pedido, Entrega_Pedido)
                   ELSE NULL END)                               AS avg_minutos
        FROM AKR_Pedidos
        WHERE CAST(Creacion_Pedido AS DATE) = CAST(GETDATE() AS DATE)
      `),
      pool.request().query(`
        SELECT Estado, COUNT(*) AS cantidad
        FROM AKR_Pedidos
        GROUP BY Estado
      `),
      pool.request().query(`
        SELECT TOP 10
          p.Id_Pedido, p.Estado, p.Creacion_Pedido, p.Total,
          c.Nombre_Usuario AS Nombre_Cliente
        FROM AKR_Pedidos p
        INNER JOIN AKR_Usuarios c ON p.Id_Cliente = c.Id_Usuario
        ORDER BY p.Creacion_Pedido DESC
      `),
    ]);

    // Repartidores activos (con pedido en_camino o asignado hoy)
    const repsActivos = await pool.request().query(`
      SELECT COUNT(DISTINCT Id_Repartidor) AS repartidores_activos
      FROM AKR_Pedidos
      WHERE Estado IN ('asignado','en_camino')
        AND CAST(Creacion_Pedido AS DATE) = CAST(GETDATE() AS DATE)
    `);

    return res.json({
      kpis: {
        ...kpis.recordset[0],
        repartidores_activos: repsActivos.recordset[0].repartidores_activos,
      },
      porEstado: porEstado.recordset,
      recientes: recientes.recordset,
    });
  } catch (err) {
    console.error('GET /reportes/dashboard:', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

// GET /api/reportes/tiempos  — estadísticas de entrega (CP076-078)
router.get('/tiempos', soloAdmin, async (req, res) => {
  const { desde, hasta } = req.query;
  try {
    const pool = await getPool();
    const req2 = pool.request();
    let where = `
      Entrega_Pedido IS NOT NULL
      AND Asignacion_Pedido IS NOT NULL
    `;
    if (desde) { req2.input('desde', sql.DateTime, new Date(desde)); where += ' AND Creacion_Pedido >= @desde'; }
    if (hasta) { req2.input('hasta', sql.DateTime, new Date(hasta)); where += ' AND Creacion_Pedido <= @hasta'; }

    const result = await req2.query(`
      SELECT
        COUNT(*)                                                                 AS total,
        AVG(DATEDIFF(MINUTE, Asignacion_Pedido, Entrega_Pedido))                AS promedio,
        MIN(DATEDIFF(MINUTE, Asignacion_Pedido, Entrega_Pedido))                AS minimo,
        MAX(DATEDIFF(MINUTE, Asignacion_Pedido, Entrega_Pedido))                AS maximo,
        STDEV(DATEDIFF(MINUTE, Asignacion_Pedido, Entrega_Pedido))              AS desviacion
      FROM AKR_Pedidos
      WHERE ${where}
    `);

    return res.json(result.recordset[0]);
  } catch (err) {
    console.error('GET /reportes/tiempos:', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

// GET /api/reportes/repartidores  — ranking de repartidores (CP079-081)
router.get('/repartidores', soloAdmin, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        u.Id_Usuario,
        u.Nombre_Usuario + ' ' + u.Apellido_Usuario AS Nombre,
        COUNT(p.Id_Pedido)                           AS total_pedidos,
        SUM(CASE WHEN p.Estado = 'entregado' THEN 1 ELSE 0 END) AS entregados,
        AVG(CASE WHEN p.Entrega_Pedido IS NOT NULL AND p.Asignacion_Pedido IS NOT NULL
                 THEN DATEDIFF(MINUTE, p.Asignacion_Pedido, p.Entrega_Pedido)
                 ELSE NULL END)                      AS avg_minutos
      FROM AKR_Usuarios u
      LEFT JOIN AKR_Pedidos p ON p.Id_Repartidor = u.Id_Usuario
      WHERE u.Id_Roles = 2
      GROUP BY u.Id_Usuario, u.Nombre_Usuario, u.Apellido_Usuario
      ORDER BY entregados DESC
    `);
    return res.json(result.recordset);
  } catch (err) {
    console.error('GET /reportes/repartidores:', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

// GET /api/reportes/zonas  — heatmap de zonas (CP082-084)
router.get('/zonas', soloAdmin, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        ROUND(Lat_Destino, 3)  AS lat,
        ROUND(Lng_Destino, 3)  AS lng,
        COUNT(*)               AS frecuencia,
        AVG(CASE WHEN Entrega_Pedido IS NOT NULL AND Asignacion_Pedido IS NOT NULL
                 THEN DATEDIFF(MINUTE, Asignacion_Pedido, Entrega_Pedido)
                 ELSE NULL END) AS avg_minutos
      FROM AKR_Pedidos
      WHERE Lat_Destino IS NOT NULL AND Lng_Destino IS NOT NULL
      GROUP BY ROUND(Lat_Destino, 3), ROUND(Lng_Destino, 3)
      ORDER BY frecuencia DESC
    `);
    return res.json(result.recordset);
  } catch (err) {
    console.error('GET /reportes/zonas:', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

// GET /api/reportes/piloto  — comparativa FIFO vs ACO (tesis)
router.get('/piloto', soloAdmin, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        JSON_VALUE(v.Productos, '$[1]._fase')     AS fase,
        JSON_VALUE(v.Productos, '$[1]._jornada')  AS jornada,
        COUNT(*)                                   AS n,
        CAST(AVG(CAST(DATEDIFF(minute, v.Creacion_Pedido, v.Entrega_Pedido) AS FLOAT)) AS DECIMAL(5,1)) AS tpe_promedio,
        MIN(DATEDIFF(minute, v.Creacion_Pedido, v.Entrega_Pedido))  AS tpe_min,
        MAX(DATEDIFF(minute, v.Creacion_Pedido, v.Entrega_Pedido))  AS tpe_max,
        CAST(100.0 * SUM(CASE WHEN DATEDIFF(minute, v.Creacion_Pedido, v.Entrega_Pedido) <= 45 THEN 1 ELSE 0 END) / COUNT(*) AS DECIMAL(4,1)) AS pct_45min
      FROM AKR_Pedidos v
      WHERE v.Estado = 'entregado'
        AND v.Entrega_Pedido IS NOT NULL
        AND v.Productos IS NOT NULL
        AND JSON_VALUE(v.Productos, '$[1]._fase') IN ('FIFO', 'ACO')
      GROUP BY JSON_VALUE(v.Productos, '$[1]._fase'), JSON_VALUE(v.Productos, '$[1]._jornada')
      ORDER BY fase, jornada
    `);
    return res.json(result.recordset);
  } catch (err) {
    console.error('GET /reportes/piloto:', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

export default router;
