// Configuración del negocio (AKR_ConfigNegocio): validación, GET público, PUT
// solo admin y cobertura de pedidos según el local configurado. Base simulada.
import { describe, it, before, after, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = "secreto-solo-para-tests";

const consultas = [];
let filaNegocio = null; // null → tabla sin fila
let tablaExiste = true;

function crearRequest() {
  const inputs = {};
  return {
    input(nombre, _tipo, valor) {
      inputs[nombre] = valor;
      return this;
    },
    async query(texto) {
      consultas.push({ texto, inputs });
      if (/AKR_ConfigNegocio/.test(texto) && !tablaExiste) throw new Error("Invalid object name 'AKR_ConfigNegocio'.");
      if (/FROM AKR_ConfigNegocio/.test(texto)) return { recordset: filaNegocio ? [filaNegocio] : [] };
      if (/INSERT INTO AKR_Pedidos/.test(texto)) return { recordset: [{ Id_Pedido: 99 }], rowsAffected: [1] };
      return { recordset: [], rowsAffected: [1] };
    },
  };
}

mock.module("../db.js", {
  namedExports: {
    getPool: async () => ({ request: crearRequest }),
    sql: { Int: "Int", Float: "Float", Bit: "Bit", DateTime: "DateTime", MAX: "MAX", NVarChar: () => "NVarChar", Decimal: () => "Decimal" },
  },
});

const { default: express } = await import("express");
const { default: configRoutes } = await import("../routes/config.js");
const { default: pedidosRoutes } = await import("../routes/pedidos.js");
const { validarNegocio, NEGOCIO_DEFECTO, _limpiarCache } = await import("../lib/negocio.js");

let servidor;
let base;
before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/config", configRoutes);
  app.use("/api/pedidos", pedidosRoutes);
  await new Promise((r) => {
    servidor = app.listen(0, "127.0.0.1", r);
  });
  base = `http://127.0.0.1:${servidor.address().port}/api`;
});
after(() => servidor.close());

beforeEach(() => {
  consultas.length = 0;
  filaNegocio = null;
  tablaExiste = true;
  _limpiarCache();
});

const token = (role, id = 1) => jwt.sign({ id, email: "a@x.pe", role }, process.env.JWT_SECRET, { algorithm: "HS256" });
const pedir = (ruta, metodo = "GET", tk = null, body) =>
  fetch(`${base}${ruta}`, {
    method: metodo,
    headers: { "Content-Type": "application/json", ...(tk ? { Authorization: `Bearer ${tk}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });

const VALIDO = { nombre: "Pollería Don Pepe", direccion: "Av. Arequipa 1234, Lince", lat: -12.0833, lng: -77.0347, radioKm: 5, telefono: "+51987654321" };

describe("validarNegocio", () => {
  it("acepta datos válidos y redondea el radio a 0,1 km", () => {
    assert.deepEqual(validarNegocio({ ...VALIDO, radioKm: 4.26 }).datos, { ...VALIDO, radioKm: 4.3 });
  });
  for (const [caso, cambio] of [
    ["nombre corto", { nombre: "X" }],
    ["dirección vacía", { direccion: "" }],
    ["latitud fuera de rango", { lat: 95 }],
    ["longitud no numérica", { lng: "abc" }],
    ["sin coordenadas", { lat: null }],
    ["punto 0,0 (no fijado)", { lat: 0, lng: 0 }],
    ["radio 0", { radioKm: 0 }],
    ["radio > 50 km", { radioKm: 60 }],
    ["teléfono con letras", { telefono: "98765abc" }],
    ["teléfono demasiado corto", { telefono: "123" }],
  ])
    it(`rechaza: ${caso}`, () => assert.ok(validarNegocio({ ...VALIDO, ...cambio }).error));
});

describe("teléfono del local", () => {
  it("es opcional y se guarda sin espacios ni guiones", () => {
    assert.equal(validarNegocio({ ...VALIDO, telefono: "" }).datos.telefono, null);
    assert.equal(validarNegocio({ ...VALIDO, telefono: undefined }).datos.telefono, null);
    assert.equal(validarNegocio({ ...VALIDO, telefono: "01 234-5678" }).datos.telefono, "012345678");
  });
});

describe("GET /api/config/negocio", () => {
  it("es público y devuelve la fila guardada", async () => {
    filaNegocio = { Nombre_Local: "Don Pepe", Direccion: "Av. X 1", Lat: -12.1, Lng: -77.0, Radio_Km: 4, Telefono: "012345678" };
    const r = await pedir("/config/negocio");
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { nombre: "Don Pepe", direccion: "Av. X 1", lat: -12.1, lng: -77.0, radioKm: 4, telefono: "012345678" });
  });
  it("base sin la columna Telefono (002 anterior) → telefono null", async () => {
    filaNegocio = { Nombre_Local: "Don Pepe", Direccion: "Av. X 1", Lat: -12.1, Lng: -77.0, Radio_Km: 4 };
    assert.equal((await (await pedir("/config/negocio")).json()).telefono, null);
  });
  it("sin migración 002 responde los valores de siempre", async () => {
    tablaExiste = false;
    assert.deepEqual(await (await pedir("/config/negocio")).json(), { ...NEGOCIO_DEFECTO });
  });
});

describe("PUT /api/config/negocio", () => {
  it("sin token → 401; repartidor o cliente → 403", async () => {
    assert.equal((await pedir("/config/negocio", "PUT", null, VALIDO)).status, 401);
    assert.equal((await pedir("/config/negocio", "PUT", token("driver"), VALIDO)).status, 403);
    assert.equal((await pedir("/config/negocio", "PUT", token("customer"), VALIDO)).status, 403);
    assert.ok(!consultas.some((c) => /MERGE AKR_ConfigNegocio/.test(c.texto)));
  });
  it("datos inválidos → 400", async () => {
    assert.equal((await pedir("/config/negocio", "PUT", token("admin"), { ...VALIDO, lat: 200 })).status, 400);
  });
  it("admin guarda, se audita y el GET siguiente ya ve el cambio", async () => {
    const r = await pedir("/config/negocio", "PUT", token("admin"), VALIDO);
    assert.equal(r.status, 200);
    const merge = consultas.find((c) => /MERGE AKR_ConfigNegocio/.test(c.texto));
    assert.equal(merge.inputs.lat, VALIDO.lat);
    assert.equal(merge.inputs.radio, 5);
    assert.equal(merge.inputs.tel, "+51987654321");
    const audit = consultas.find((c) => /INSERT INTO AKR_Auditoria/.test(c.texto));
    assert.equal(audit.inputs.evento, "config_negocio_actualizada");
    assert.deepEqual(await (await pedir("/config/negocio")).json(), VALIDO);
  });
  it("sin migración 002 → 503", async () => {
    tablaExiste = false;
    assert.equal((await pedir("/config/negocio", "PUT", token("admin"), VALIDO)).status, 503);
  });
});

describe("POST /api/pedidos usa el local configurado", () => {
  const pedido = (lat, lng, extra = {}) => ({ latDestino: lat, lngDestino: lng, direccionDestino: "Calle 1", ...extra });

  it("cobertura con el radio y el centro guardados por el admin", async () => {
    filaNegocio = { Nombre_Local: "Don Pepe", Direccion: "Lince", Lat: -12.0833, Lng: -77.0347, Radio_Km: 2 };
    // ~1,1 km del local nuevo: dentro
    assert.equal((await pedir("/pedidos", "POST", token("customer", 5), pedido(-12.0733, -77.0347))).status, 201);
    // el local original (SMP) está a ~7 km del nuevo: fuera de 2 km
    const r = await pedir("/pedidos", "POST", token("customer", 5), pedido(-12.0278455, -77.0895871));
    assert.equal(r.status, 400);
    assert.match((await r.json()).error, /máximo 2 km/);
  });

  it("el origen del pedido es el local configurado, aunque el cliente envíe otro", async () => {
    filaNegocio = { Nombre_Local: "Don Pepe", Direccion: "Lince", Lat: -12.0833, Lng: -77.0347, Radio_Km: 2 };
    await pedir("/pedidos", "POST", token("customer", 5), pedido(-12.0733, -77.0347, { latOrigen: -12.0278455, lngOrigen: -77.0895871 }));
    const ins = consultas.find((c) => /INSERT INTO AKR_Pedidos/.test(c.texto));
    assert.equal(ins.inputs.latOrigen, -12.0833);
    assert.equal(ins.inputs.lngOrigen, -77.0347);
  });

  it("sin migración 002 mantiene el comportamiento anterior (SMP, 3 km)", async () => {
    tablaExiste = false;
    const r = await pedir("/pedidos", "POST", token("customer", 5), pedido(-12.0833, -77.0347));
    assert.equal(r.status, 400);
    assert.match((await r.json()).error, /máximo 3 km/);
  });
});
