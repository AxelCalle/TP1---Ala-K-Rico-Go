import { describe, it, expect } from "vitest";
import { RESTAURANTE_COORDS, RESTAURANTE_DIRECCION, ESTADO_PEDIDO_ES } from "../lib/constants";

describe("RESTAURANTE_COORDS", () => {
  it("es un array de dos números", () => {
    expect(Array.isArray(RESTAURANTE_COORDS)).toBe(true);
    expect(RESTAURANTE_COORDS).toHaveLength(2);
    expect(typeof RESTAURANTE_COORDS[0]).toBe("number");
    expect(typeof RESTAURANTE_COORDS[1]).toBe("number");
  });

  it("la latitud está en el rango de Lima (-12 ± 0.5)", () => {
    const [lat] = RESTAURANTE_COORDS;
    expect(lat).toBeGreaterThan(-12.5);
    expect(lat).toBeLessThan(-11.5);
  });

  it("la longitud está en el rango de Lima (-77 ± 0.5)", () => {
    const [, lng] = RESTAURANTE_COORDS;
    expect(lng).toBeGreaterThan(-77.5);
    expect(lng).toBeLessThan(-76.5);
  });
});

describe("RESTAURANTE_DIRECCION", () => {
  it("contiene el distrito SMP", () => {
    expect(RESTAURANTE_DIRECCION).toMatch(/San Mart[ií]n de Porres/i);
  });

  it("contiene Perú en el texto", () => {
    expect(RESTAURANTE_DIRECCION).toMatch(/Per[uú]/i);
  });
});

describe("ESTADO_PEDIDO_ES", () => {
  const estadosEsperados = ["sin_asignar", "asignado", "en_camino", "entregado", "cancelado"];

  it("contiene todos los estados del flujo de pedido", () => {
    estadosEsperados.forEach((e) => {
      expect(ESTADO_PEDIDO_ES).toHaveProperty(e);
    });
  });

  it("los valores son strings no vacíos", () => {
    estadosEsperados.forEach((e) => {
      expect(typeof ESTADO_PEDIDO_ES[e]).toBe("string");
      expect(ESTADO_PEDIDO_ES[e].length).toBeGreaterThan(0);
    });
  });

  it("'entregado' y 'cancelado' son estados terminales con etiquetas en español", () => {
    expect(ESTADO_PEDIDO_ES["entregado"]).toBe("Entregado");
    expect(ESTADO_PEDIDO_ES["cancelado"]).toBe("Cancelado");
  });
});
