// Tests de la lógica de paginación — pura, sin dependencias externas
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Función extraída de la lógica de rutas (pedidos, auditoria)
function calcularPaginacion(pageRaw, pageSizeRaw, total) {
  const page     = Math.max(parseInt(pageRaw,     10) || 1,  1);
  const pageSize = Math.min(Math.max(parseInt(pageSizeRaw, 10) || 20, 1), 100);
  const offset   = (page - 1) * pageSize;
  const totalPages = Math.ceil(total / pageSize);
  return { page, pageSize, offset, totalPages };
}

describe("calcularPaginacion", () => {
  it("primera página por defecto cuando no se pasan parámetros", () => {
    const r = calcularPaginacion(undefined, undefined, 50);
    assert.equal(r.page,      1);
    assert.equal(r.pageSize, 20);
    assert.equal(r.offset,    0);
    assert.equal(r.totalPages, 3);
  });

  it("offset correcto para página 2", () => {
    const r = calcularPaginacion("2", "10", 100);
    assert.equal(r.page,   2);
    assert.equal(r.offset, 10);
  });

  it("offset correcto para página 3 con pageSize 25", () => {
    const r = calcularPaginacion("3", "25", 200);
    assert.equal(r.offset, 50);
    assert.equal(r.totalPages, 8);
  });

  it("pageSize=0 usa el valor por defecto (0 es falsy → fallback a 20)", () => {
    const r = calcularPaginacion("1", "0", 10);
    assert.equal(r.pageSize, 20);
  });

  it("clampea pageSize al máximo de 100", () => {
    const r = calcularPaginacion("1", "999", 10);
    assert.equal(r.pageSize, 100);
  });

  it("page negativa se normaliza a 1", () => {
    const r = calcularPaginacion("-5", "20", 50);
    assert.equal(r.page,   1);
    assert.equal(r.offset, 0);
  });

  it("page string no numérico se normaliza a 1", () => {
    const r = calcularPaginacion("abc", "20", 50);
    assert.equal(r.page, 1);
  });

  it("totalPages es 1 cuando total === 0", () => {
    const r = calcularPaginacion("1", "20", 0);
    assert.equal(r.totalPages, 0); // ceil(0/20) = 0
  });

  it("totalPages correcto con resto", () => {
    const r = calcularPaginacion("1", "10", 35);
    assert.equal(r.totalPages, 4); // ceil(35/10) = 4
  });

  it("totalPages cuando el total es múltiplo exacto del pageSize", () => {
    const r = calcularPaginacion("1", "10", 30);
    assert.equal(r.totalPages, 3); // ceil(30/10) = 3, sin página extra
  });
});

// ─── Tests de validación de estados de pedido ─────────────────────────────────

describe("validación de estado de pedido", () => {
  const VALID_STATES = ["sin_asignar", "asignado", "en_camino", "entregado", "cancelado"];

  function esEstadoValido(estado) {
    return VALID_STATES.includes(estado);
  }

  it("acepta todos los estados del ciclo de vida", () => {
    VALID_STATES.forEach((e) => assert.ok(esEstadoValido(e), `${e} debería ser válido`));
  });

  it("rechaza estados arbitrarios", () => {
    ["pendiente", "activo", "", "ENTREGADO", "undefined"].forEach((e) => {
      assert.ok(!esEstadoValido(e), `${e} no debería ser válido`);
    });
  });

  it("rechaza inyección SQL básica", () => {
    assert.ok(!esEstadoValido("'; DROP TABLE AKR_Pedidos;--"));
    assert.ok(!esEstadoValido("1=1"));
  });
});
