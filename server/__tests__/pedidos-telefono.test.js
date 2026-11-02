// Incidencia 0002404 (CP052 / HU018): el cliente puede llamar a su repartidor.
// El teléfono solo se expone mientras el pedido está asignado o en camino.
import { describe, it, before, after, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = "secreto-solo-para-tests";

const consultas = [];
let filaPedido = null;

function crearRequest() {
  const inputs = {};
  return {
    input(nombre, _tipo, valor) {
      inputs[nombre] = valor;
      return this;
    },
    async query(texto) {
      consultas.push({ texto, inputs });
      if (/WHERE p\.Id_Pedido = @id/.test(texto)) return { recordset: filaPedido ? [filaPedido] : [] };
      return { recordset: [], rowsAffected: [1] };
    },
  };
}

mock.module("../db.js", {
  namedExports: {
    getPool: async () => ({ request: crearRequest }),
    sql: { Int: "Int", Float: "Float", NVarChar: () => "NVarChar" },
  },
});

const { default: express } = await import("express");
const { default: pedidosRoutes } = await import("../routes/pedidos.js");

let servidor;
let base;
before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/pedidos", pedidosRoutes);
  await new Promise((r) => {
    servidor = app.listen(0, "127.0.0.1", r);
  });
  base = `http://127.0.0.1:${servidor.address().port}/api/pedidos`;
});
after(() => servidor.close());
beforeEach(() => {
  consultas.length = 0;
  filaPedido = null;
});

const token = (role, id) => jwt.sign({ id, email: "x@x.pe", role }, process.env.JWT_SECRET, { algorithm: "HS256" });
const CONDICION = /CASE WHEN p\.Estado IN \('asignado','en_camino'\) THEN r\.Telf_Usuario END AS Telf_Repartidor/;

describe("teléfono del repartidor para el cliente", () => {
  it("la lista del cliente lo pide solo para pedidos activos", async () => {
    const r = await fetch(base, { headers: { Authorization: `Bearer ${token("customer", 5)}` } });
    assert.equal(r.status, 200);
    assert.match(consultas.at(-1).texto, CONDICION);
  });

  it("el detalle del pedido aplica la misma condición", async () => {
    filaPedido = { Id_Pedido: 1, Id_Cliente: 5, Id_Repartidor: 9, Estado: "en_camino", Telf_Repartidor: "987654321" };
    const r = await fetch(`${base}/1`, { headers: { Authorization: `Bearer ${token("customer", 5)}` } });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).Telf_Repartidor, "987654321");
    assert.match(consultas.at(-1).texto, CONDICION);
  });

  it("otro cliente no puede ver el pedido (ni el teléfono)", async () => {
    filaPedido = { Id_Pedido: 1, Id_Cliente: 5, Id_Repartidor: 9, Estado: "en_camino", Telf_Repartidor: "987654321" };
    const r = await fetch(`${base}/1`, { headers: { Authorization: `Bearer ${token("customer", 6)}` } });
    assert.equal(r.status, 403);
  });
});
