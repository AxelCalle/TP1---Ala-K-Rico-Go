// Tests de las rutas de ubicación/recorrido con la base de datos simulada
// (node --test --experimental-test-module-mocks). No se conecta a SQL Server.
import { describe, it, before, after, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = "secreto-solo-para-tests";

// ── Pool simulado: registra cada consulta y responde según el SQL ────────────
const consultas = [];
let fallarRecorrido = false;
let puntosBD = [];
let entregasBD = [];

function crearRequest() {
  const inputs = {};
  return {
    input(nombre, _tipo, valor) {
      inputs[nombre] = valor;
      return this;
    },
    async query(texto) {
      consultas.push({ texto, inputs });
      if (fallarRecorrido && /AKR_Recorrido/.test(texto)) {
        throw new Error("Invalid object name 'AKR_Recorrido'.");
      }
      if (/FROM AKR_Recorrido/.test(texto) && /SELECT/.test(texto)) return { recordset: puntosBD };
      if (/FROM AKR_Pedidos p/.test(texto)) return { recordset: entregasBD };
      return { recordset: [], rowsAffected: [1] };
    },
  };
}

mock.module("../db.js", {
  namedExports: {
    getPool: async () => ({ request: crearRequest }),
    sql: { Int: "Int", Float: "Float", DateTime2: "DateTime2", NVarChar: () => "NVarChar" },
  },
});

const { default: express } = await import("express");
const { default: jwt } = await import("jsonwebtoken");
const { default: router } = await import("../routes/repartidores.js");

const token = (usuario) => jwt.sign(usuario, process.env.JWT_SECRET, { algorithm: "HS256" });
const REPARTIDOR = token({ id: 7, role: "driver" });
const OTRO = token({ id: 8, role: "driver" });
const ADMIN = token({ id: 1, role: "admin" });
const CLIENTE = token({ id: 30, role: "customer" });

let servidor;
let base;

before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/repartidores", router);
  await new Promise((ok) => {
    servidor = app.listen(0, ok);
  });
  base = `http://127.0.0.1:${servidor.address().port}/api/repartidores`;
});

after(() => servidor?.close());

beforeEach(() => {
  consultas.length = 0;
  fallarRecorrido = false;
  puntosBD = [];
  entregasBD = [];
});

async function llamar(metodo, ruta, jwtToken, cuerpo) {
  const res = await fetch(`${base}${ruta}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${jwtToken}`, "Content-Type": "application/json" },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

describe("PUT /:id/ubicacion", () => {
  it("guarda la última posición y agrega el punto al historial", async () => {
    const r = await llamar("PUT", "/7/ubicacion", REPARTIDOR, {
      lat: -12.03,
      lng: -77.09,
      precision: 9,
      idPedido: 101,
    });
    assert.equal(r.status, 200);
    assert.ok(consultas[0].texto.includes("MERGE AKR_Ubicaciones"));
    const insert = consultas.find((c) => c.texto.includes("INSERT INTO AKR_Recorrido"));
    assert.ok(insert, "no insertó en AKR_Recorrido");
    assert.deepEqual(insert.inputs, { id: 7, ped: 101, lat: -12.03, lng: -77.09, pre: 9 });
    // El pedido solo se asocia si pertenece al repartidor
    assert.match(insert.texto, /Id_Repartidor = @id/);
  });

  it("acepta el cuerpo anterior (solo lat/lng)", async () => {
    const r = await llamar("PUT", "/7/ubicacion", REPARTIDOR, { lat: -12.03, lng: -77.09 });
    assert.equal(r.status, 200);
    const insert = consultas.find((c) => c.texto.includes("INSERT INTO AKR_Recorrido"));
    assert.equal(insert.inputs.pre, null);
    assert.equal(insert.inputs.ped, null);
  });

  it("si falta la tabla AKR_Recorrido el seguimiento en vivo sigue funcionando", async () => {
    fallarRecorrido = true;
    const r = await llamar("PUT", "/7/ubicacion", REPARTIDOR, { lat: -12.03, lng: -77.09 });
    assert.equal(r.status, 200);
    assert.ok(consultas[0].texto.includes("MERGE AKR_Ubicaciones"));
  });

  it("rechaza coordenadas inválidas sin tocar la base", async () => {
    const r = await llamar("PUT", "/7/ubicacion", REPARTIDOR, { lat: 200, lng: -77 });
    assert.equal(r.status, 400);
    assert.equal(consultas.length, 0);
  });

  it("un repartidor no puede escribir la ubicación de otro", async () => {
    const r = await llamar("PUT", "/7/ubicacion", OTRO, { lat: -12, lng: -77 });
    assert.equal(r.status, 403);
    assert.equal(consultas.length, 0);
  });
});

describe("GET /:id/recorrido", () => {
  it("el admin obtiene puntos, resumen y entregas del día en hora de Lima", async () => {
    puntosBD = [
      { Lat: -12, Lng: -77, Precision_M: 8, Id_Pedido: 101, Fecha: new Date("2026-10-13T13:00:00Z") },
      { Lat: -12.001, Lng: -77, Precision_M: 8, Id_Pedido: 101, Fecha: new Date("2026-10-13T13:01:00Z") },
    ];
    entregasBD = [{ Id_Pedido: 101, Lat_Destino: -12.001, Lng_Destino: -77 }];
    const r = await llamar("GET", "/7/recorrido?fecha=2026-10-13", ADMIN);
    assert.equal(r.status, 200);
    assert.equal(r.body.fecha, "2026-10-13");
    assert.equal(r.body.puntos.length, 2);
    assert.equal(r.body.entregas.length, 1);
    assert.equal(r.body.resumen.duracionMin, 1);
    assert.ok(Math.abs(r.body.resumen.distanciaM - 111) <= 2);
    const sel = consultas.find((c) => /FROM AKR_Recorrido/.test(c.texto) && /SELECT/.test(c.texto));
    assert.equal(sel.inputs.desde.toISOString(), "2026-10-13T05:00:00.000Z");
    assert.equal(sel.inputs.hasta.toISOString(), "2026-10-14T05:00:00.000Z");
    // Retención de 90 días
    assert.ok(consultas.some((c) => /DELETE FROM AKR_Recorrido/.test(c.texto) && c.inputs.dias === 90));
  });

  it("el repartidor puede ver su propio recorrido, no el de otro", async () => {
    assert.equal((await llamar("GET", "/7/recorrido?fecha=2026-10-13", REPARTIDOR)).status, 200);
    assert.equal((await llamar("GET", "/7/recorrido?fecha=2026-10-13", OTRO)).status, 403);
  });

  it("los clientes no tienen acceso al historial", async () => {
    assert.equal((await llamar("GET", "/7/recorrido", CLIENTE)).status, 403);
  });

  it("rechaza una fecha mal formada", async () => {
    assert.equal((await llamar("GET", "/7/recorrido?fecha=13-10-2026", ADMIN)).status, 400);
  });

  it("sin la migración responde 503 con un mensaje claro", async () => {
    fallarRecorrido = true;
    const r = await llamar("GET", "/7/recorrido?fecha=2026-10-13", ADMIN);
    assert.equal(r.status, 503);
    assert.match(r.body.error, /migración 001/);
  });
});
