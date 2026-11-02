import { describe, expect, it } from "vitest";
import { ejecutarACO_TSP, type Stop } from "@/lib/aco";

const depot: Stop = { id: "depot", lat: -12.0278, lng: -77.0896, label: "Local" };
const p = (id: string, lat: number, lng: number): Stop => ({ id, lat, lng, label: id });

describe("ejecutarACO_TSP — garantía ACO ≤ FIFO (CP068)", () => {
  it("nunca devuelve una ruta más larga que el orden de llegada", () => {
    // Llegada en zigzag: el FIFO va y vuelve entre zonas alejadas
    const stops = [
      depot,
      p("1", -12.0031, -77.085),
      p("2", -12.0142, -77.1098),
      p("3", -11.9855, -77.0672),
      p("4", -12.0098, -77.0903),
      p("5", -11.9712, -77.0648),
    ];
    for (let k = 0; k < 10; k++) {
      const r = ejecutarACO_TSP(stops)!;
      expect(r.distanciaKm).toBeLessThanOrEqual(r.distanciaFifoKm);
      expect(r.orden[0].id).toBe("depot");
      expect(new Set(r.orden.map((s) => s.id)).size).toBe(stops.length);
    }
  });

  it("si el ACO no mejora (1 iteración, 1 hormiga), usa el orden FIFO", () => {
    // Paradas en línea recta en orden de llegada: el FIFO ya es óptimo
    const stops = [
      depot,
      ...[1, 2, 3, 4, 5, 6].map((i) => p(String(i), -12.0278 + i * 0.005, -77.0896)),
    ];
    const r = ejecutarACO_TSP(stops, { numAnts: 1, iterations: 1 })!;
    expect(r.distanciaKm).toBe(r.distanciaFifoKm);
    expect(r.orden.map((s) => s.id)).toEqual(stops.map((s) => s.id));
  });
});
