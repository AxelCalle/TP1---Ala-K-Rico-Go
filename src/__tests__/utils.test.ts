import { describe, it, expect } from "vitest";
import { cn } from "../lib/utils";

describe("cn (class merger)", () => {
  it("concatena clases simples", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("ignora valores falsy", () => {
    expect(cn("a", undefined, null, false, "b")).toBe("a b");
  });

  it("aplica tailwind-merge — la última clase de la misma utilidad gana", () => {
    // tailwind-merge resuelve conflictos: px-2 vs px-4 → px-4 gana
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("acepta objetos condicionales", () => {
    expect(cn({ "text-red-500": true, "text-blue-500": false })).toBe("text-red-500");
  });

  it("acepta arrays anidados", () => {
    expect(cn(["a", "b"], "c")).toBe("a b c");
  });

  it("devuelve string vacío cuando no hay argumentos válidos", () => {
    expect(cn()).toBe("");
    expect(cn(undefined, null, false)).toBe("");
  });

  it("maneja clases duplicadas — tailwind-merge las deduplica", () => {
    expect(cn("p-4", "p-4")).toBe("p-4");
  });
});
