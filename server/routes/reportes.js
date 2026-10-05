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
// Ambas fases se calculan desde AKR_Pedidos (pedidos entregados):
// FIFO = fase AS-IS del piloto, con despacho manual por orden de llegada:
//        pedidos creados desde PILOTO_INICIO_FIFO y antes de PILOTO_INICIO_ACO.
// ACO  = fase TO-BE con ACO-DeliRoute: pedidos creados desde PILOTO_INICIO_ACO
//        y antes de PILOTO_FIN (exclusivo), para no mezclar pedidos de prueba posteriores.
// TPE  = minutos desde el registro del pedido hasta la confirmación de entrega.
const PILOTO_INICIO_FIFO = process.env.PILOTO_INICIO_FIFO || '2026-06-01';
const PILOTO_INICIO_ACO  = process.env.PILOTO_INICIO_ACO  || '2026-06-26';
const PILOTO_FIN         = process.env.PILOTO_FIN         || '2026-07-07';

async function metricasFase(pool, desde, hasta) {
  const r = await pool.request()
    .input('desde', sql.Date, desde)
    .input('hasta', sql.Date, hasta)
    .query(`
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
        AND Creacion_Pedido >= @desde
        AND Creacion_Pedido <  @hasta
    `);
  const m = r.recordset[0];
  return {
    n:            m.n            ?? 0,
    tpe_promedio: m.tpe_promedio ?? null,
    tpe_min:      m.tpe_min      ?? null,
    tpe_max:      m.tpe_max      ?? null,
    pct_45min:    m.pct_45min    ?? null,
  };
}

router.get('/piloto', soloAdmin, async (req, res) => {
  try {
    const pool = await getPool();
    const fifo = await metricasFase(pool, PILOTO_INICIO_FIFO, PILOTO_INICIO_ACO);
    const aco  = await metricasFase(pool, PILOTO_INICIO_ACO, PILOTO_FIN);
    const ambos = fifo.tpe_promedio != null && aco.tpe_promedio != null;

    return res.json({
      inicio_aco: PILOTO_INICIO_ACO,
      fifo: { fase: 'FIFO', descripcion: 'Despacho manual por orden de llegada (fase AS-IS del piloto)', ...fifo },
      aco:  { fase: 'ACO',  descripcion: 'Rutas optimizadas con ACO-DeliRoute (fase TO-BE del piloto)', ...aco },
      mejora: ambos
        ? {
            reduccion_min:  +(fifo.tpe_promedio - aco.tpe_promedio).toFixed(1),
            reduccion_pct:  +(((fifo.tpe_promedio - aco.tpe_promedio) / fifo.tpe_promedio) * 100).toFixed(1),
            mejora_pct_45:  +((aco.pct_45min ?? 0) - (fifo.pct_45min ?? 0)).toFixed(1),
          }
        : null,
    });
  } catch (err) {
    console.error('GET /reportes/piloto:', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

export default router;
