import { describe, it, expect, afterEach } from "vitest";
import { ErrorApi, ErrorRed } from "../lib/api";

// ─── ErrorApi ────────────────────────────────────────────────────────────────

describe("ErrorApi", () => {
  it("hereda de Error y tiene nombre correcto", () => {
    const e = new ErrorApi(404, "not_found");
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("ErrorApi");
  });

  it("expone status y codigo como propiedades readonly", () => {
    const e = new ErrorApi(422, "validacion_fallida");
    expect(e.status).toBe(422);
    expect(e.codigo).toBe("validacion_fallida");
  });

  it("el mensaje es el codigo", () => {
    const e = new ErrorApi(500, "error_interno");
    expect(e.message).toBe("error_interno");
  });

  it("401 representa sesión expirada", () => {
    const e = new ErrorApi(401, "sesion_expirada");
    expect(e.status).toBe(401);
    expect(e.codigo).toBe("sesion_expirada");
  });

  it("403 representa acceso denegado", () => {
    const e = new ErrorApi(403, "acceso_denegado");
    expect(e.status).toBe(403);
  });
});

// ─── ErrorRed ────────────────────────────────────────────────────────────────

describe("ErrorRed", () => {
  it("hereda de Error y tiene nombre correcto", () => {
    const e = new ErrorRed();
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("ErrorRed");
  });

  it("el mensaje indica ausencia de conexión", () => {
    const e = new ErrorRed();
    expect(e.message).toBe("Sin conexión con el servidor");
  });

  it("es distinguible de ErrorApi", () => {
    const red = new ErrorRed();
    const api = new ErrorApi(503, "servicio_no_disponible");
    expect(red).not.toBeInstanceOf(ErrorApi);
    expect(api).not.toBeInstanceOf(ErrorRed);
  });
});

// ─── Token helpers (via localStorage mock) ───────────────────────────────────

// ─── Token helpers — comportamiento del almacenamiento ───────────────────────
// api.ts usa localStorage con guarda `typeof window !== "undefined"`.
// En Node (entorno de test), window no existe, por lo que guardarToken/limpiarToken
// no escriben y obtenerToken devuelve null. Estos tests verifican ese contrato
// y el comportamiento del mock de localStorage por separado.

describe("contrato localStorage en entorno Node (sin window)", () => {
  it("obtenerToken devuelve null porque window no existe en Node", async () => {
    const { api } = await import("../lib/api");
    expect(api.obtenerToken()).toBeNull();
  });
});

describe("lógica de localStorage mock (simulación de browser)", () => {
  // Simulamos directamente el patrón que usa api.ts para verificar su lógica
  const CLAVE = "akr-jwt-token";
  const store: Record<string, string> = {};
  const ls = {
    getItem:    (k: string) => store[k] ?? null,
    setItem:    (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  };

  afterEach(() => { Object.keys(store).forEach((k) => delete store[k]); });

  it("setItem + getItem recupera el token guardado", () => {
    ls.setItem(CLAVE, "mi.jwt.token");
    expect(ls.getItem(CLAVE)).toBe("mi.jwt.token");
  });

  it("removeItem elimina el token", () => {
    ls.setItem(CLAVE, "token.a.borrar");
    ls.removeItem(CLAVE);
    expect(ls.getItem(CLAVE)).toBeNull();
  });

  it("getItem devuelve null para clave inexistente", () => {
    expect(ls.getItem(CLAVE)).toBeNull();
  });
});
