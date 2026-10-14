import type { RecorridoApi } from "./api";
import { PRECISION_UTIL_M, type Coords } from "./gps";

/** Igual que el servidor: un hueco de señal mayor a 5 min corta la línea. */
export const HUECO_MAX_MS = 5 * 60 * 1000;

/**
 * Separa los puntos del historial en tramos continuos para dibujarlos, sin las
 * lecturas demasiado imprecisas. En un corte de señal largo no se une con una
 * línea recta: se empieza un tramo nuevo.
 */
export function tramosRecorrido(puntos: RecorridoApi["puntos"]): Coords[][] {
  const tramos: Coords[][] = [];
  let actual: Coords[] = [];
  let tPrev = 0;
  for (const p of puntos) {
    if (p.Precision_M !== null && p.Precision_M > PRECISION_UTIL_M) continue;
    const t = new Date(p.Fecha).getTime();
    if (actual.length && t - tPrev > HUECO_MAX_MS) {
      tramos.push(actual);
      actual = [];
    }
    actual.push([p.Lat, p.Lng]);
    tPrev = t;
  }
  if (actual.length) tramos.push(actual);
  return tramos;
}
