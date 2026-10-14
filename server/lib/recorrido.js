// Lógica pura del historial GPS (AKR_Recorrido): validación de puntos,
// rango horario de un día en Lima y resumen del recorrido. Sin base de datos.

/** Lima no tiene horario de verano: UTC−5 todo el año. */
const OFFSET_LIMA_MS = 5 * 60 * 60 * 1000;
/** Un hueco mayor a esto (sin señal, app cerrada) corta el recorrido en tramos. */
export const HUECO_MAX_MS = 5 * 60 * 1000;
/** Días que se conserva el historial. */
export const RETENCION_DIAS = 90;

/**
 * Valida el cuerpo de PUT /ubicacion. `precision` e `idPedido` son opcionales
 * (clientes anteriores solo envían lat/lng).
 */
export function validarPunto(body = {}) {
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (body.lat === undefined || body.lng === undefined || body.lat === null || body.lng === null) {
    return { error: 'lat y lng son obligatorios.' };
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { error: 'lat y lng deben ser coordenadas válidas.' };
  }
  let precision = null;
  if (body.precision !== undefined && body.precision !== null) {
    precision = Number(body.precision);
    if (!Number.isFinite(precision) || precision < 0) {
      return { error: 'precision debe ser un número positivo (metros).' };
    }
  }
  let idPedido = null;
  if (body.idPedido !== undefined && body.idPedido !== null) {
    idPedido = Number(body.idPedido);
    if (!Number.isInteger(idPedido) || idPedido <= 0) {
      return { error: 'idPedido inválido.' };
    }
  }
  return { lat, lng, precision, idPedido };
}

/** "2026-10-13" → { desde, hasta } en UTC que cubren ese día en hora de Lima. */
export function rangoDiaLima(fecha) {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;
  const [a, m, d] = fecha.split('-').map(Number);
  const inicioUtc = Date.UTC(a, m - 1, d);
  const comprobacion = new Date(inicioUtc);
  if (comprobacion.getUTCMonth() !== m - 1 || comprobacion.getUTCDate() !== d) return null;
  const desde = new Date(inicioUtc + OFFSET_LIMA_MS);
  const hasta = new Date(desde.getTime() + 24 * 60 * 60 * 1000);
  return { desde, hasta };
}

/** Fecha de hoy en Lima ("YYYY-MM-DD"). */
export function hoyLima(ahora = Date.now()) {
  return new Date(ahora - OFFSET_LIMA_MS).toISOString().slice(0, 10);
}

function distanciaM(a, b) {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/**
 * Resume una lista de puntos ordenados por fecha: distancia recorrida,
 * tiempo en movimiento y tramos (se corta en huecos de señal largos para no
 * sumar una línea recta inventada entre dos puntos lejanos en el tiempo).
 * @param {{lat:number,lng:number,fecha:Date|string}[]} puntos
 */
export function resumirRecorrido(puntos) {
  const tramos = [];
  let actual = [];
  let distancia = 0;
  let duracion = 0;
  for (let i = 0; i < puntos.length; i++) {
    const p = puntos[i];
    const t = new Date(p.fecha).getTime();
    const prev = puntos[i - 1];
    if (prev) {
      const dt = t - new Date(prev.fecha).getTime();
      if (dt > HUECO_MAX_MS) {
        tramos.push(actual);
        actual = [];
      } else {
        distancia += distanciaM(prev, p);
        duracion += Math.max(0, dt);
      }
    }
    actual.push(p);
  }
  if (actual.length) tramos.push(actual);
  return {
    puntos: puntos.length,
    tramos: tramos.length,
    distanciaM: Math.round(distancia),
    duracionMin: Math.round(duracion / 60000),
    inicio: puntos[0] ? new Date(puntos[0].fecha).toISOString() : null,
    fin: puntos.length ? new Date(puntos[puntos.length - 1].fecha).toISOString() : null,
  };
}
