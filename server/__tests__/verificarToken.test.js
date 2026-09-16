// Tests unitarios para el middleware verificarToken
// Usa el test runner nativo de Node.js (node:test) — zero deps adicionales.
import { describe, it, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

// ─── Helpers de mock ─────────────────────────────────────────────────────────

function makeRes() {
  const res = {
    _status: null,
    _json:   null,
    status(code) { this._status = code; return this; },
    json(data)   { this._json = data;   return this; },
  };
  return res;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("verificarToken", () => {
  let verificarToken;

  // Cargamos el módulo con un JWT_SECRET de prueba
  beforeEach(async () => {
    process.env.JWT_SECRET = "secreto_test_1234";
    // Forzamos reimportación limpia en cada test
    const mod = await import("../middleware/verificarToken.js");
    verificarToken = mod.verificarToken;
  });

  it("responde 401 cuando no hay header Authorization", (_, done) => {
    const req  = { headers: {} };
    const res  = makeRes();
    const next = () => done(new Error("next() no debería llamarse"));

    verificarToken(req, res, next);

    assert.equal(res._status, 401);
    assert.ok(res._json?.error);
    done();
  });

  it("responde 401 cuando el header no empieza con 'Bearer '", (_, done) => {
    const req  = { headers: { authorization: "Basic abc123" } };
    const res  = makeRes();
    const next = () => done(new Error("next() no debería llamarse"));

    verificarToken(req, res, next);

    assert.equal(res._status, 401);
    done();
  });

  it("responde 401 cuando el token es inválido", (_, done) => {
    const req  = { headers: { authorization: "Bearer token.falso.aqui" } };
    const res  = makeRes();
    const next = () => done(new Error("next() no debería llamarse"));

    verificarToken(req, res, next);

    assert.equal(res._status, 401);
    assert.match(res._json?.error, /inválido|expirado/i);
    done();
  });

  it("llama next() e inyecta req.usuario con un token válido", async () => {
    const jwt = await import("jsonwebtoken");
    const token = jwt.default.sign(
      { id: 42, email: "test@ejemplo.com", role: "admin" },
      process.env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "1h" }
    );

    const req  = { headers: { authorization: `Bearer ${token}` } };
    const res  = makeRes();
    let nextLlamado = false;
    const next = () => { nextLlamado = true; };

    verificarToken(req, res, next);

    assert.ok(nextLlamado, "next() debería haberse llamado");
    assert.equal(req.usuario?.id,    42);
    assert.equal(req.usuario?.email, "test@ejemplo.com");
    assert.equal(req.usuario?.role,  "admin");
  });

  it("responde 401 con token de algoritmo diferente (HS384)", async () => {
    const jwt = await import("jsonwebtoken");
    const tokenHS384 = jwt.default.sign(
      { id: 1, role: "admin" },
      process.env.JWT_SECRET,
      { algorithm: "HS384" }
    );

    const req  = { headers: { authorization: `Bearer ${tokenHS384}` } };
    const res  = makeRes();
    const next = mock.fn();

    verificarToken(req, res, next);

    assert.equal(res._status, 401);
    assert.equal(next.mock.calls.length, 0);
  });
});
