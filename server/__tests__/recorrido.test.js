// Tests del historial GPS (lógica pura, sin base de datos)
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  HUECO_MAX_MS,
  hoyLima,
  rangoDiaLima,
  resumirRecorrido,
  validarPunto,
} from "../lib/recorrido.js";

describe("validarPunto", () => {
  it("acepta lat/lng solos (clientes anteriores)", () => {
    assert.deepEqual(validarPunto({ lat: -12.03, lng: -77.09 }), {
      lat: -12.03,
      lng: -77.09,
      precision: null,
      idPedido: null,
    });
  });

  it("acepta precisión e id de pedido", () => {
    const r = validarPunto({ lat: "-12.03", lng: "-77.09", precision: 8.5, idPedido: 101 });
    assert.equal(r.precision, 8.5);
    assert.equal(r.idPedido, 101);
  });

  it("rechaza coordenadas faltantes o imposibles", () => {
    assert.ok(validarPunto({ lng: -77 }).error);
    assert.ok(validarPunto({ lat: null, lng: -77 }).error);
    assert.ok(validarPunto({ lat: 95, lng: -77 }).error);
    assert.ok(validarPunto({ lat: -12, lng: "abc" }).error);
  });

  it("rechaza precisión negativa e id de pedido inválido", () => {
    assert.ok(validarPunto({ lat: -12, lng: -77, precision: -3 }).error);
    assert.ok(validarPunto({ lat: -12, lng: -77, idPedido: 1.5 }).error);
    assert.ok(validarPunto({ lat: -12, lng: -77, idPedido: 0 }).error);
  });
});

describe("rangoDiaLima", () => {
  it("el día de Lima va de 05:00 UTC a 05:00 UTC del día siguiente", () => {
    const r = rangoDiaLima("2026-10-13");
    assert.equal(r.desde.toISOString(), "2026-10-13T05:00:00.000Z");
    assert.equal(r.hasta.toISOString(), "2026-10-14T05:00:00.000Z");
  });

  it("rechaza fechas mal formadas o inexistentes", () => {
    assert.equal(rangoDiaLima("13/10/2026"), null);
    assert.equal(rangoDiaLima("2026-02-30"), null);
    assert.equal(rangoDiaLima(undefined), null);
  });

  it("hoyLima usa la hora de Lima, no UTC", () => {
    // 2026-10-14 03:00 UTC = 2026-10-13 22:00 en Lima
    assert.equal(hoyLima(Date.UTC(2026, 9, 14, 3)), "2026-10-13");
  });
});

describe("resumirRecorrido", () => {
  const t0 = Date.UTC(2026, 9, 13, 12);
  // ≈111 m por cada 0.001° de latitud
  const p = (i, seg) => ({ lat: -12 + i * 0.001, lng: -77, fecha: new Date(t0 + seg * 1000) });

  it("sin puntos devuelve un resumen vacío", () => {
    assert.deepEqual(resumirRecorrido([]), {
      puntos: 0,
      tramos: 0,
      distanciaM: 0,
      duracionMin: 0,
      inicio: null,
      fin: null,
    });
  });

  it("suma distancia y tiempo entre puntos consecutivos", () => {
    const r = resumirRecorrido([p(0, 0), p(1, 60), p(2, 120)]);
    assert.equal(r.puntos, 3);
    assert.equal(r.tramos, 1);
    assert.ok(Math.abs(r.distanciaM - 222) <= 2, `distancia ${r.distanciaM}`);
    assert.equal(r.duracionMin, 2);
  });

  it("un hueco de señal largo corta el tramo y no suma esa distancia", () => {
    const hueco = HUECO_MAX_MS / 1000 + 60;
    const r = resumirRecorrido([p(0, 0), p(1, 60), p(50, 60 + hueco), p(51, 120 + hueco)]);
    assert.equal(r.tramos, 2);
    assert.ok(r.distanciaM < 250, `distancia ${r.distanciaM}`);
    assert.equal(r.duracionMin, 2);
  });
});
