// Reportes y estadísticas — CP076-087 (HU026-029)
import { Router } from 'express';
import { getPool, sql } from '../db.js';
import { verificarToken } from '../middleware/verificarToken.js';
import { rangoDiaLima } from '../lib/recorrido.js';
import { analizarRetrasos, mensajeDemora } from '../lib/analisis.js';

// Las fechas se guardan en UTC (Azure SQL): "hoy" se calcula en hora de Lima (UTC−5)
const HOY_LIMA = 'CAST(DATEADD(HOUR, -5, GETUTCDATE()) AS DATE)';
const diaLima = (col) => `CAST(DATEADD(HOUR, -5, ${col}) AS DATE)`;
const MINUTOS = 'CAST(DATEDIFF(MINUTE, Asignacion_Pedido, Entrega_Pedido) AS FLOAT)';

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
      // KPIs de HOY en hora de Lima: pedidos creados hoy y entregas realizadas hoy
      pool.request().query(`
        SELECT
          SUM(CASE WHEN ${diaLima('Creacion_Pedido')} = ${HOY_LIMA} THEN 1 ELSE 0 END) AS total_hoy,
          SUM(CASE WHEN Estado = 'entregado' AND ${diaLima('Entrega_Pedido')} = ${HOY_LIMA}
                   THEN 1 ELSE 0 END)                                                 AS entregados,
          SUM(CASE WHEN Estado = 'cancelado' AND ${diaLima('Cancelacion_Pedido')} = ${HOY_LIMA}
                   THEN 1 ELSE 0 END)                                                 AS cancelados,
          ROUND(AVG(CASE WHEN Estado = 'entregado' AND Asignacion_Pedido IS NOT NULL
                          AND ${diaLima('Entrega_Pedido')} = ${HOY_LIMA}
                         THEN ${MINUTOS} ELSE NULL END), 1)                           AS avg_minutos
        FROM AKR_Pedidos
      `),
      // Promedio histórico de entrega (todos los pedidos con ambos timestamps)
      pool.request().query(`
        SELECT ROUND(AVG(${MINUTOS}), 1) AS avg_historico
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
        total_hoy:           kpisHoy.recordset[0].total_hoy ?? 0,
        activos:             activosAhora.recordset[0].activos,
        entregados:          kpisHoy.recordset[0].entregados ?? 0,
        cancelados:          kpisHoy.recordset[0].cancelados ?? 0,
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

// GET /api/reportes/tiempos?desde=YYYY-MM-DD&hasta=YYYY-MM-DD — estadísticas de entrega (CP076-078)
// Las fechas son días completos en hora de Lima, ambos inclusive; el tiempo de
// entrega se mide desde la asignación hasta la entrega.
router.get('/tiempos', soloAdmin, async (req, res) => {
  const { desde, hasta } = req.query;
  const rDesde = desde ? rangoDiaLima(String(desde)) : null;
  const rHasta = hasta ? rangoDiaLima(String(hasta)) : null;
  if (desde && !rDesde) return res.status(400).json({ error: 'Fecha "desde" inválida.' });
  if (hasta && !rHasta) return res.status(400).json({ error: 'Fecha "hasta" inválida.' });
  if (rDesde && rHasta && rDesde.desde > rHasta.desde) {
    return res.status(400).json({ error: 'La fecha "desde" no puede ser posterior a "hasta".' });
  }

  try {
    const pool = await getPool();
    const req2 = pool.request();
    let where = `
      Entrega_Pedido IS NOT NULL
      AND Asignacion_Pedido IS NOT NULL
    `;
    if (rDesde) { req2.input('desde', sql.DateTime2, rDesde.desde); where += ' AND Creacion_Pedido >= @desde'; }
    if (rHasta) { req2.input('hasta', sql.DateTime2, rHasta.hasta); where += ' AND Creacion_Pedido < @hasta'; }

    const result = await req2.query(`
      SELECT
        COUNT(*)                          AS total,
        ROUND(AVG(${MINUTOS}), 1)         AS promedio,
        MIN(${MINUTOS})                   AS minimo,
        MAX(${MINUTOS})                   AS maximo,
        ROUND(STDEV(${MINUTOS}), 1)       AS desviacion
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
        ROUND(AVG(CASE WHEN p.Entrega_Pedido IS NOT NULL AND p.Asignacion_Pedido IS NOT NULL
                 THEN CAST(DATEDIFF(MINUTE, p.Asignacion_Pedido, p.Entrega_Pedido) AS FLOAT)
                 ELSE NULL END), 1)                  AS avg_minutos
      FROM AKR_Usuarios u
      LEFT JOIN AKR_Pedidos p ON p.Id_Repartidor = u.Id_Usuario
      WHERE u.Id_Roles = 2
      GROUP BY u.Id_Usuario, u.Nombre_Usuario, u.Apellido_Usuario
      ORDER BY entregados DESC, avg_minutos ASC
    `);
    // Promedio general histórico: referencia fija para la etiqueta "Atención" (HU027)
    const general = await pool.request().query(`
      SELECT ROUND(AVG(${MINUTOS}), 1) AS promedio_general
      FROM AKR_Pedidos
      WHERE Entrega_Pedido IS NOT NULL AND Asignacion_Pedido IS NOT NULL AND Id_Repartidor IS NOT NULL
    `);
    const promedioGeneral = general.recordset[0]?.promedio_general ?? null;
    return res.json(result.recordset.map((r) => ({ ...r, promedio_general: promedioGeneral })));
  } catch (err) {
    console.error('GET /reportes/repartidores:', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

// GET /api/reportes/zonas  — frecuencia de pedidos por coordenada (apoyo al análisis)
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

// ─── Análisis de retrasos (HU029, CP085-087) ─────────────────────────────────
const DIAS_ANALISIS = 30;

async function datosAnalisis(pool) {
  const [pedidos, config] = await Promise.all([
    pool.request().input('dias', sql.Int, DIAS_ANALISIS).query(`
      SELECT p.Id_Pedido, p.Id_Repartidor,
             u.Nombre_Usuario + ' ' + u.Apellido_Usuario AS Nombre_Repartidor,
             p.Lat_Origen, p.Lng_Origen, p.Lat_Destino, p.Lng_Destino,
             p.Asignacion_Pedido, p.Entrega_Pedido
      FROM AKR_Pedidos p
      LEFT JOIN AKR_Usuarios u ON u.Id_Usuario = p.Id_Repartidor
      WHERE p.Estado = 'entregado' AND p.Id_Repartidor IS NOT NULL
        AND p.Asignacion_Pedido IS NOT NULL AND p.Entrega_Pedido IS NOT NULL
        AND p.Entrega_Pedido >= DATEADD(DAY, -@dias, GETUTCDATE())
    `),
    pool.request().query('SELECT Clave, Valor FROM AKR_ConfigACO'),
  ]);
  const cfg = {};
  for (const row of config.recordset) cfg[row.Clave] = row.Valor;
  return analizarRetrasos(pedidos.recordset, cfg);
}

/**
 * Ejecuta el análisis y registra una alerta por cada demora recurrente
 * (una sola vez por día y por zona o repartidor). Lo usa el proceso diario.
 */
export async function ejecutarAnalisisRetrasos() {
  const pool = await getPool();
  const resultado = await datosAnalisis(pool);
  let alertasCreadas = 0;
  for (const d of resultado.demoras) {
    const clave = `${d.tipo}:${d.id}`;
    const ins = await pool.request()
      .input('tipo',  sql.NVarChar(60),      'retraso_recurrente')
      .input('msg',   sql.NVarChar(500),     mensajeDemora(d))
      .input('clave', sql.NVarChar(100),     clave)
      .input('datos', sql.NVarChar(sql.MAX), JSON.stringify({ clave, ...d }))
      .query(`
        IF NOT EXISTS (
          SELECT 1 FROM AKR_Alertas_Admin
          WHERE Tipo = @tipo AND JSON_VALUE(Datos, '$.clave') = @clave
            AND ${diaLima('Creacion')} = ${HOY_LIMA}
        )
        INSERT INTO AKR_Alertas_Admin (Tipo, Mensaje, Datos) VALUES (@tipo, @msg, @datos)
      `);
    alertasCreadas += ins.rowsAffected?.[0] ?? 0;
  }
  return { ...resultado, alertasCreadas };
}

// GET /api/reportes/analisis — resultado actual del análisis (sin crear alertas)
router.get('/analisis', soloAdmin, async (_req, res) => {
  try {
    const pool = await getPool();
    return res.json({ dias: DIAS_ANALISIS, ...(await datosAnalisis(pool)) });
  } catch (err) {
    console.error('GET /reportes/analisis:', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

// POST /api/reportes/analisis — ejecuta el análisis ahora y registra las alertas
router.post('/analisis', soloAdmin, async (_req, res) => {
  try {
    return res.json({ dias: DIAS_ANALISIS, ...(await ejecutarAnalisisRetrasos()) });
  } catch (err) {
    console.error('POST /reportes/analisis:', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

export default router;
