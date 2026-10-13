import { describe, it, expect } from "vitest";
import { HUECO_MAX_MS, tramosRecorrido } from "../lib/recorrido";

const T0 = Date.UTC(2026, 9, 13, 12);

function punto(lat: number, seg: number, precision: number | null = 8) {
  return {
    Lat: lat,
    Lng: -77,
    Precision_M: precision,
    Id_Pedido: null,
    Fecha: new Date(T0 + seg * 1000).toISOString(),
  };
}

describe("tramosRecorrido", () => {
  it("sin puntos no hay tramos", () => {
    expect(tramosRecorrido([])).toEqual([]);
  });

  it("puntos seguidos forman un solo tramo en orden", () => {
    expect(tramosRecorrido([punto(-12, 0), punto(-12.001, 10), punto(-12.002, 20)])).toEqual([
      [
        [-12, -77],
        [-12.001, -77],
        [-12.002, -77],
      ],
    ]);
  });

  it("un corte de señal largo empieza un tramo nuevo", () => {
    const hueco = HUECO_MAX_MS / 1000 + 1;
    const t = tramosRecorrido([punto(-12, 0), punto(-12.001, 10), punto(-12.05, 10 + hueco)]);
    expect(t).toHaveLength(2);
    expect(t[1]).toEqual([[-12.05, -77]]);
  });

  it("omite lecturas muy imprecisas y conserva las que no informan precisión", () => {
    const t = tramosRecorrido([punto(-12, 0), punto(-12.3, 5, 900), punto(-12.001, 10, null)]);
    expect(t).toEqual([
      [
        [-12, -77],
        [-12.001, -77],
      ],
    ]);
  });
});
