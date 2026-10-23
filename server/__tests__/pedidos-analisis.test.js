// Reglas de estado de pedidos y análisis de retrasos (lógica pura)
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validarTransicion } from "../lib/pedidos.js";
import {
  analizarRetrasos,
  factorTrafico,
  horaLima,
  mensajeDemora,
  recomendar,
  zonaDe,
} from "../lib/analisis.js";

describe("validarTransicion", () => {
  it("el repartidor inicia la entrega y la confirma", () => {
    assert.deepEqual(validarTransicion("driver", "asignado", "en_camino"), { ok: true, sinCambios: false });
    assert.equal(validarTransicion("driver", "en_camino", "entregado").ok, true);
  });

  it("el repartidor puede confirmar desde la ruta un pedido asignado", () => {
    assert.equal(validarTransicion("driver", "asignado", "entregado").ok, true);
  });

  it("un reintento sobre el mismo estado no repite efectos", () => {
    assert.deepEqual(validarTransicion("driver", "entregado", "entregado"), { ok: true, sinCambios: true });
  });

  it("un pedido entregado o cancelado ya no cambia", () => {
    const r = validarTransicion("driver", "entregado", "en_camino");
    assert.equal(r.status, 409);
    assert.match(r.error, /ya está entregado/);
    assert.equal(validarTransicion("admin", "cancelado", "asignado").status, 409);
  });

  it("el repartidor no puede cambiar a otros estados", () => {
    assert.equal(validarTransicion("driver", "asignado", "cancelado").status, 403);
  });

  it("el cliente solo cancela pedidos sin asignar", () => {
    assert.equal(validarTransicion("customer", "sin_asignar", "cancelado").ok, true);
    const r = validarTransicion("customer", "asignado", "cancelado");
    assert.equal(r.status, 400);
    assert.equal(r.error, "Solo puedes cancelar pedidos sin asignar.");
  });

  it("el admin no pone en camino un pedido sin repartidor", () => {
    assert.equal(validarTransicion("admin", "sin_asignar", "en_camino").status, 409);
    const r = validarTransicion("admin", "en_camino", "asignado", { tieneRepartidor: false });
    assert.equal(r.status, 400);
  });

  it("rechaza estados desconocidos", () => {
    assert.equal(validarTransicion("admin", "asignado", "perdido").status, 400);
  });
});

describe("análisis de retrasos (HU029)", () => {
  const ORIGEN = { Lat_Origen: -12.0278455, Lng_Origen: -77.0895871 };
  // ~1,5 km al norte del restaurante → zona 1–2 km
  const destino = { Lat_Destino: -12.0143, Lng_Destino: -77.0895871 };
  // Asignación a las 16:00 UTC = 11:00 en Lima (factor 1,2)
  const pedido = (id, rep, minutos, extra = {}) => ({
    Id_Pedido: id,
    Id_Repartidor: rep,
    Nombre_Repartidor: `Rep ${rep}`,
    ...ORIGEN,
    ...destino,
    Asignacion_Pedido: new Date(Date.UTC(2026, 9, 20, 16, 0)),
    Entrega_Pedido: new Date(Date.UTC(2026, 9, 20, 16, minutos)),
    ...extra,
  });

  it("hora de Lima y factor de tráfico por franja", () => {
    assert.equal(horaLima(new Date(Date.UTC(2026, 9, 20, 2, 0))), 21);
    assert.equal(factorTrafico(8), 1.5);
    assert.equal(factorTrafico(11), 1.2);
    assert.equal(factorTrafico(22), 1.0);
  });

  it("zonas por anillos de distancia", () => {
    assert.equal(zonaDe(0.4).id, "0-1");
    assert.equal(zonaDe(1.5).id, "1-2");
    assert.equal(zonaDe(2.9).id, "2-3");
  });

  it("detecta una demora recurrente (más de 30 % en 3 o más entregas)", () => {
    // Estimado ≈ 1,5 km / 25 km/h × 60 × 1,2 ≈ 4 min; real 10 min
    const r = analizarRetrasos([pedido(1, 7, 10), pedido(2, 7, 10), pedido(3, 7, 10)], { beta: 3.5, iterations: 100 });
    assert.equal(r.entregasAnalizadas, 3);
    const zona = r.zonas.find((z) => z.id === "1-2");
    assert.equal(zona.entregas, 3);
    assert.equal(zona.demoraRecurrente, true);
    assert.ok(zona.retrasoPct > 30);
    assert.equal(r.demoras.filter((d) => d.tipo === "zona").length, 1);
    assert.equal(r.demoras.filter((d) => d.tipo === "repartidor").length, 1);
    assert.match(mensajeDemora(r.demoras[0]), /^Demora recurrente en Zona 1–2 km: /);
  });

  it("no marca demora con menos de 3 entregas o sin retraso", () => {
    assert.equal(analizarRetrasos([pedido(1, 7, 10), pedido(2, 7, 10)]).demoras.length, 0);
    assert.equal(analizarRetrasos([pedido(1, 7, 4), pedido(2, 7, 4), pedido(3, 7, 4)]).demoras.length, 0);
  });

  it("sugiere parámetros del ACO dentro de los rangos permitidos", () => {
    const s = recomendar([{ id: "1-2" }], { beta: 3.5, iterations: 100 });
    assert.deepEqual(s.map((x) => [x.parametro, x.sugerido]), [["beta", 4], ["iterations", 150]]);
    const tope = recomendar([{ id: "1-2" }], { beta: 5, iterations: 200 });
    assert.equal(tope.length, 0);
    assert.equal(recomendar([], { beta: 3.5 }).length, 0);
  });

  it("ignora pedidos sin fechas o coordenadas", () => {
    const r = analizarRetrasos([pedido(1, 7, 10, { Asignacion_Pedido: null }), pedido(2, 7, 10, { Lat_Destino: null })]);
    assert.equal(r.entregasAnalizadas, 0);
  });
});
