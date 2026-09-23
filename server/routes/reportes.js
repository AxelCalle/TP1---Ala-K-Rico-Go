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

    const [kpisHoy, avgHistorico, activosAhora, repsActivos, porEstado, recientes] = await Promise.all([
      // KPIs filtrados por HOY (pedidos creados hoy)
      pool.request().query(`
        SELECT
          COUNT(*)                                                AS total_hoy,
          SUM(CASE WHEN Estado = 'entregado' THEN 1 ELSE 0 END) AS entregados,
          SUM(CASE WHEN Estado = 'cancelado' THEN 1 ELSE 0 END) AS cancelados,
          AVG(CASE WHEN Entrega_Pedido IS NOT NULL AND Asignacion_Pedido IS NOT NULL
                   THEN DATEDIFF(MINUTE, Asignacion_Pedido, Entrega_Pedido)
                   ELSE NULL END)                               AS avg_minutos
        FROM AKR_Pedidos
        WHERE CAST(Creacion_Pedido AS DATE) = CAST(GETDATE() AS DATE)
      `),
      // Promedio histórico de entrega (todos los pedidos con ambos timestamps)
      pool.request().query(`
        SELECT AVG(DATEDIFF(MINUTE, Asignacion_Pedido, Entrega_Pedido)) AS avg_historico
        FROM AKR_Pedidos
        WHERE Entrega_Pedido IS NOT NULL AND Asignacion_Pedido IS NOT NULL
      `),
      // Pedidos activos AHORA (independiente de cuándo fueron creados)
      pool.request().query(`
        SELECT COUNT(*) AS activos
        FROM AKR_Pedidos
        WHERE Estado IN ('sin_asignar', 'asignado', 'en_camino')
      `),
      // Repartidores con pedido activo AHORA
      pool.request().query(`
        SELECT COUNT(DISTINCT Id_Repartidor) AS repartidores_activos
        FROM AKR_Pedidos
        WHERE Estado IN ('asignado', 'en_camino')
          AND Id_Repartidor IS NOT NULL
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
        LEFT JOIN AKR_Usuarios c ON p.Id_Cliente = c.Id_Usuario
        ORDER BY p.Creacion_Pedido DESC
      `),
    ]);

    return res.json({
      kpis: {
        total_hoy:           kpisHoy.recordset[0].total_hoy,
        activos:             activosAhora.recordset[0].activos,
        entregados:          kpisHoy.recordset[0].entregados,
        cancelados:          kpisHoy.recordset[0].cancelados,
        avg_minutos:         kpisHoy.recordset[0].avg_minutos,
        avg_historico:       avgHistorico.recordset[0].avg_historico,
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

  const parseDate = (val) => {
    if (!val) return null;
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    return d;
  };

  const fechaDesde = desde ? parseDate(desde) : null;
  const fechaHasta = hasta ? parseDate(hasta) : null;
  if (desde && !fechaDesde) return res.status(400).json({ error: 'Fecha "desde" inválida.' });
  if (hasta && !fechaHasta) return res.status(400).json({ error: 'Fecha "hasta" inválida.' });

  try {
    const pool = await getPool();
    const req2 = pool.request();
    let where = `
      Entrega_Pedido IS NOT NULL
      AND Asignacion_Pedido IS NOT NULL
    `;
    if (fechaDesde) { req2.input('desde', sql.DateTime, fechaDesde); where += ' AND Creacion_Pedido >= @desde'; }
    if (fechaHasta) { req2.input('hasta', sql.DateTime, fechaHasta); where += ' AND Creacion_Pedido <= @hasta'; }

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
//
// FIFO = proceso manual previo a la app (datos de referencia histórica,
//        tiempos aproximados sin herramienta de optimización).
//        No existe en la BD porque nunca hubo sistema que lo auditara.
//
// ACO  = lo que produce la app (calculado en tiempo real desde AKR_Pedidos).
const FIFO_REFERENCIA = {
  fase:          'FIFO',
  descripcion:   'Proceso manual sin optimización (referencia histórica)',
  n:             87,           // muestra de jornadas previas a la app
  tpe_promedio:  72.4,         // minutos promedio creación → entrega
  tpe_min:       38,
  tpe_max:       124,
  pct_45min:     19.5,         // % de pedidos entregados en ≤ 45 min
  pedidos_por_ruta: 3.1,       // promedio de paradas por recorrido manual
};

router.get('/piloto', soloAdmin, async (req, res) => {
  try {
    const pool = await getPool();

    const acoResult = await pool.request().query(`
      SELECT
        COUNT(*)                                                                           AS n,
        CAST(AVG(CAST(DATEDIFF(minute, Creacion_Pedido, Entrega_Pedido) AS FLOAT)) AS DECIMAL(5,1)) AS tpe_promedio,
        MIN(DATEDIFF(minute, Creacion_Pedido, Entrega_Pedido))                             AS tpe_min,
        MAX(DATEDIFF(minute, Creacion_Pedido, Entrega_Pedido))                             AS tpe_max,
        CAST(
          100.0 * SUM(CASE WHEN DATEDIFF(minute, Creacion_Pedido, Entrega_Pedido) <= 45
                           THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)
        AS DECIMAL(4,1))                                                                   AS pct_45min
      FROM AKR_Pedidos
      WHERE Estado        = 'entregado'
        AND Entrega_Pedido IS NOT NULL
        AND Creacion_Pedido IS NOT NULL
    `);

    const aco = acoResult.recordset[0];

    return res.json({
      fifo: FIFO_REFERENCIA,
      aco: {
        fase:        'ACO',
        descripcion: 'Optimización con Colonia de Hormigas (sistema actual)',
        n:            aco.n            ?? 0,
        tpe_promedio: aco.tpe_promedio ?? null,
        tpe_min:      aco.tpe_min      ?? null,
        tpe_max:      aco.tpe_max      ?? null,
        pct_45min:    aco.pct_45min    ?? null,
      },
      mejora: aco.tpe_promedio != null
        ? {
            reduccion_min:  +(FIFO_REFERENCIA.tpe_promedio - aco.tpe_promedio).toFixed(1),
            reduccion_pct:  +(((FIFO_REFERENCIA.tpe_promedio - aco.tpe_promedio) / FIFO_REFERENCIA.tpe_promedio) * 100).toFixed(1),
            mejora_pct_45:  +(aco.pct_45min - FIFO_REFERENCIA.pct_45min).toFixed(1),
          }
        : null,
    });
  } catch (err) {
    console.error('GET /reportes/piloto:', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

export default router;
