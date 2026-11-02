// Tests de DELETE /api/auth/cuenta con la base de datos simulada
// (node --test --experimental-test-module-mocks). No se conecta a SQL Server.
import { describe, it, before, after, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = "secreto-solo-para-tests";

const HASH = bcrypt.hashSync("clave-correcta", 4);
const consultas = [];
let usuarioBD;
let pedidosEnCurso;

function crearRequest() {
  const inputs = {};
  return {
    input(nombre, _tipo, valor) {
      inputs[nombre] = valor;
      return this;
    },
    async query(texto) {
      consultas.push({ texto, inputs });
      if (/SELECT Contraseña_Usuario, Activo_Usuario/.test(texto)) return { recordset: usuarioBD ? [usuarioBD] : [] };
      if (/COUNT\(\*\) AS total FROM AKR_Pedidos/.test(texto)) return { recordset: [{ total: pedidosEnCurso }] };
      return { recordset: [], rowsAffected: [1] };
    },
  };
}

mock.module("../db.js", {
  namedExports: {
    getPool: async () => ({ request: crearRequest }),
    sql: { Int: "Int", NVarChar: () => "NVarChar" },
  },
});

const { default: express } = await import("express");
const { default: authRoutes } = await import("../routes/auth.js");

let servidor;
let base;
before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  await new Promise((r) => {
    servidor = app.listen(0, "127.0.0.1", r);
  });
  base = `http://127.0.0.1:${servidor.address().port}/api/auth/cuenta`;
});
after(() => servidor.close());

beforeEach(() => {
  consultas.length = 0;
  usuarioBD = { Contraseña_Usuario: HASH, Activo_Usuario: true };
  pedidosEnCurso = 0;
});

const token = (role, id = 7) => jwt.sign({ id, email: "c@x.pe", role }, process.env.JWT_SECRET, { algorithm: "HS256" });
const borrar = (tk, body) =>
  fetch(base, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", ...(tk ? { Authorization: `Bearer ${tk}` } : {}) },
    body: JSON.stringify(body ?? {}),
  });
const anonimizacion = () => consultas.find((c) => /BEGIN TRANSACTION/.test(c.texto));

describe("DELETE /api/auth/cuenta", () => {
  it("sin token → 401", async () => {
    assert.equal((await borrar(null, { password: "clave-correcta" })).status, 401);
  });

  it("repartidor o admin → 403 (los gestiona el administrador)", async () => {
    assert.equal((await borrar(token("driver"), { password: "clave-correcta" })).status, 403);
    assert.equal((await borrar(token("admin"), { password: "clave-correcta" })).status, 403);
    assert.equal(anonimizacion(), undefined);
  });

  it("sin contraseña → 400", async () => {
    assert.equal((await borrar(token("customer"), {})).status, 400);
  });

  it("contraseña incorrecta → 401 y no toca datos", async () => {
    const r = await borrar(token("customer"), { password: "otra" });
    assert.equal(r.status, 401);
    assert.equal(anonimizacion(), undefined);
  });

  it("cuenta inexistente o ya eliminada → 404", async () => {
    usuarioBD = { Contraseña_Usuario: HASH, Activo_Usuario: false };
    assert.equal((await borrar(token("customer"), { password: "clave-correcta" })).status, 404);
  });

  it("con un pedido en reparto → 409", async () => {
    pedidosEnCurso = 1;
    const r = await borrar(token("customer"), { password: "clave-correcta" });
    assert.equal(r.status, 409);
    assert.equal(anonimizacion(), undefined);
  });

  it("ok: anonimiza en una sola transacción y audita sin email", async () => {
    const r = await borrar(token("customer", 42), { password: "clave-correcta" });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { ok: true });
    const q = anonimizacion();
    assert.ok(q, "debe ejecutar la transacción");
    assert.match(q.texto, /SET XACT_ABORT ON/);
    assert.match(q.texto, /Estado = 'cancelado'[\s\S]*Estado = 'sin_asignar'/);
    assert.match(q.texto, /DELETE FROM AKR_Notificaciones WHERE Id_Cliente = @id/);
    assert.match(q.texto, /Activo_Usuario = 0/);
    assert.match(q.texto, /DNI_Usuario = NULL, Telf_Usuario = NULL/);
    assert.equal(q.inputs.id, 42);
    assert.equal(q.inputs.email, "eliminado-42@cuenta-eliminada.invalid");
    assert.notEqual(q.inputs.hash, HASH);
    assert.ok(!(await bcrypt.compare("clave-correcta", q.inputs.hash)), "la contraseña anterior deja de servir");
    // No borra filas de pedidos (reportes del piloto y calificaciones)
    assert.doesNotMatch(q.texto, /DELETE FROM AKR_Pedidos/);
    const audit = consultas.find((c) => /INSERT INTO AKR_Auditoria/.test(c.texto));
    assert.equal(audit.inputs.evento, "cuenta_eliminada");
    assert.equal(audit.inputs.emailIntento, null);
  });
});
