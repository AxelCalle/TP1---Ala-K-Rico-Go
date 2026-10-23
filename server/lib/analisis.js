// Análisis de retrasos de entrega (HU029), sin base de datos.
//
// Para cada pedido entregado compara el tiempo real (asignación → entrega)
// con el tiempo estimado por el sistema: distancia en línea recta desde el
// restaurante a 25 km/h por el factor de tráfico de la hora de asignación
// (la misma fórmula del ETA de la ruta, HU014/HU016).

/** Lima: UTC−5 todo el año. */
const OFFSET_LIMA_H = -5;
export const VELOCIDAD_KMH = 25;
/** Retraso que se considera demora (30 % sobre el estimado). */
export const UMBRAL_RETRASO = 0.3;
/** Entregas mínimas de un grupo para hablar de demora "recurrente". */
export const MIN_ENTREGAS = 3;
/** Zonas: anillos de distancia desde el restaurante (cobertura de 3 km). */
export const ZONAS = [
  { id: '0-1', nombre: 'Zona 0–1 km', max: 1 },
  { id: '1-2', nombre: 'Zona 1–2 km', max: 2 },
  { id: '2-3', nombre: 'Zona 2–3 km', max: Infinity },
];

export function distanciaKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Factor de tráfico por franja horaria (igual que src/lib/aco.ts). */
export function factorTrafico(horaLima) {
  if ((horaLima >= 7 && horaLima < 9) || (horaLima >= 12 && horaLima < 14) || (horaLima >= 18 && horaLima < 20)) {
    return 1.5;
  }
  if ((horaLima >= 9 && horaLima < 12) || (horaLima >= 14 && horaLima < 18)) return 1.2;
  return 1.0;
}

export function horaLima(fecha) {
  const h = new Date(fecha).getUTCHours() + OFFSET_LIMA_H;
  return (h + 24) % 24;
}

export function zonaDe(km) {
  return ZONAS.find((z) => km < z.max) ?? ZONAS[ZONAS.length - 1];
}

/**
 * @param {{Id_Pedido:number, Id_Repartidor:number, Nombre_Repartidor?:string,
 *   Lat_Origen:number, Lng_Origen:number, Lat_Destino:number, Lng_Destino:number,
 *   Asignacion_Pedido:Date|string, Entrega_Pedido:Date|string}[]} pedidos
 */
export function medirPedidos(pedidos) {
  return pedidos
    .filter((p) => p.Asignacion_Pedido && p.Entrega_Pedido && p.Lat_Destino != null && p.Lat_Origen != null)
    .map((p) => {
      const km = distanciaKm(p.Lat_Origen, p.Lng_Origen, p.Lat_Destino, p.Lng_Destino);
      const factor = factorTrafico(horaLima(p.Asignacion_Pedido));
      const estimado = Math.max(1, Math.round((km / VELOCIDAD_KMH) * 60 * factor));
      const real = (new Date(p.Entrega_Pedido) - new Date(p.Asignacion_Pedido)) / 60000;
      return {
        idPedido: p.Id_Pedido,
        idRepartidor: p.Id_Repartidor,
        repartidor: p.Nombre_Repartidor ?? `Repartidor ${p.Id_Repartidor}`,
        zona: zonaDe(km),
        km,
        estimado,
        real: Math.max(0, real),
      };
    });
}

function agrupar(medidas, clave, nombre) {
  const grupos = new Map();
  for (const m of medidas) {
    const k = clave(m);
    if (!grupos.has(k)) grupos.set(k, { id: k, nombre: nombre(m), n: 0, real: 0, estimado: 0 });
    const g = grupos.get(k);
    g.n += 1;
    g.real += m.real;
    g.estimado += m.estimado;
  }
  return [...grupos.values()]
    .map((g) => {
      const real = g.real / g.n;
      const estimado = g.estimado / g.n;
      const retraso = estimado > 0 ? (real - estimado) / estimado : 0;
      return {
        id: String(g.id),
        nombre: g.nombre,
        entregas: g.n,
        realMin: Math.round(real * 10) / 10,
        estimadoMin: Math.round(estimado * 10) / 10,
        retrasoPct: Math.round(retraso * 1000) / 10,
        demoraRecurrente: g.n >= MIN_ENTREGAS && retraso > UMBRAL_RETRASO,
      };
    })
    .sort((a, b) => b.retrasoPct - a.retrasoPct);
}

const redondear = (v, paso) => Math.round(v / paso) * paso;

/**
 * Sugerencias de parámetros del ACO cuando hay demoras recurrentes por zona.
 * Rangos de la configuración (HU025): β 0,5–5; iteraciones 10–200.
 */
export function recomendar(zonasConDemora, config = {}) {
  if (zonasConDemora.length === 0) return [];
  const beta = Number(config.beta ?? 3.5);
  const iteraciones = Number(config.iterations ?? 100);
  const sugerencias = [];
  const nuevoBeta = Math.min(5, redondear(beta + 0.5, 0.5));
  if (nuevoBeta > beta) {
    sugerencias.push({
      parametro: 'beta',
      actual: beta,
      sugerido: nuevoBeta,
      motivo: 'Dar más peso a la distancia para visitar antes las paradas cercanas.',
    });
  }
  const nuevasIter = Math.min(200, iteraciones + 50);
  if (nuevasIter > iteraciones) {
    sugerencias.push({
      parametro: 'iterations',
      actual: iteraciones,
      sugerido: nuevasIter,
      motivo: 'Explorar más combinaciones de recorrido antes de elegir la ruta.',
    });
  }
  return sugerencias;
}

export function analizarRetrasos(pedidos, config = {}) {
  const medidas = medirPedidos(pedidos);
  const zonas = agrupar(medidas, (m) => m.zona.id, (m) => m.zona.nombre);
  const repartidores = agrupar(medidas, (m) => m.idRepartidor, (m) => m.repartidor);
  const zonasConDemora = zonas.filter((z) => z.demoraRecurrente);
  return {
    entregasAnalizadas: medidas.length,
    zonas,
    repartidores,
    demoras: [
      ...zonasConDemora.map((z) => ({ tipo: 'zona', ...z })),
      ...repartidores.filter((r) => r.demoraRecurrente).map((r) => ({ tipo: 'repartidor', ...r })),
    ],
    recomendaciones: recomendar(zonasConDemora, config),
  };
}

export function mensajeDemora(d) {
  const sujeto = d.tipo === 'zona' ? d.nombre : `el repartidor ${d.nombre}`;
  return (
    `Demora recurrente en ${sujeto}: ${d.realMin} min reales frente a ${d.estimadoMin} min ` +
    `estimados (+${d.retrasoPct} %) en ${d.entregas} entregas.`
  );
}
