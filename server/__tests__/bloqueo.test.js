// Tests del bloqueo de cuenta en el servidor (CP006) y de la validación de correo (CP001)
// con la base de datos simulada (node --test --experimental-test-module-mocks).
import { describe, it, before, after, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";

process.env.JWT_SECRET = "secreto-solo-para-tests";

const HASH = bcrypt.hashSync("clave-correcta", 4);
const auditoria = [];
let bloqueo; // { fallos, segundos } que devuelve la consulta de bloqueo

function crearRequest() {
  const inputs = {};
  return {
    input(nombre, _tipo, valor) {
      inputs[nombre] = valor;
      return this;
    },
    async query(texto) {
      if (/INSERT INTO AKR_Auditoria/.test(texto)) {
        auditoria.push(inputs.evento);
        // Cada fallo registrado suma al contador que verá la siguiente consulta
        if (inputs.evento === "login_fallido") bloqueo.fallos += 1;
        return { recordset: [], rowsAffected: [1] };
      }
      if (/AS fallos/.test(texto)) return { recordset: [{ ...bloqueo }] };
      if (/FROM AKR_Usuarios u\s+INNER JOIN AKR_Roles/.test(texto)) {
        return {
          recordset: [{
            Id_Usuario: 7, Nombre_Usuario: "Ana", Apellido_Usuario: "", Email_Usuario: "ana@x.pe",
            Contraseña_Usuario: HASH, Activo_Usuario: true, Id_Roles: 3, Nombre_Role: "Cliente",
          }],
        };
      }
      return { recordset: [], rowsAffected: [1] };
    },
  };
}

mock.module("../db.js", {
  namedExports: {
    getPool: async () => ({ request: crearRequest }),
    sql: { Int: "Int", SmallInt: "SmallInt", NVarChar: () => "NVarChar" },
  },
});

const { default: express } = await import("express");
const { default: authRoutes } = await import("../routes/auth.js");
const { correoValido } = await import("../lib/validacion.js");

let servidor;
let base;
before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  await new Promise((r) => {
    servidor = app.listen(0, "127.0.0.1", r);
  });
  base = `http://127.0.0.1:${servidor.address().port}/api/auth`;
});
after(() => servidor.close());

beforeEach(() => {
  auditoria.length = 0;
  bloqueo = { fallos: 0, segundos: 900 };
});

const login = (password) =>
  fetch(`${base}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "ana@x.pe", password }),
  });

describe("POST /login — bloqueo por cuenta (CP006)", () => {
  it("informa los intentos que quedan tras un fallo", async () => {
    bloqueo.fallos = 2;
    const res = await login("mala");
    assert.equal(res.status, 401);
    assert.equal((await res.json()).intentosRestantes, 2);
  });

  it("el quinto fallo bloquea la cuenta y responde 423 con los segundos restantes", async () => {
    bloqueo.fallos = 4;
    const res = await login("mala");
    assert.equal(res.status, 423);
    const cuerpo = await res.json();
    assert.equal(cuerpo.error, "cuenta_bloqueada");
    assert.equal(cuerpo.segundosRestantes, 900);
  });

  it("con la cuenta bloqueada rechaza incluso la contraseña correcta (cualquier navegador)", async () => {
    bloqueo.fallos = 5;
    bloqueo.segundos = 600;
    const res = await login("clave-correcta");
    assert.equal(res.status, 423);
    assert.equal((await res.json()).segundosRestantes, 600);
    // El intento durante el bloqueo no cuenta como un fallo más
    assert.deepEqual(auditoria, ["login_bloqueado"]);
  });

  it("vencido el bloqueo, la contraseña correcta ingresa", async () => {
    bloqueo.fallos = 5;
    bloqueo.segundos = -5;
    const res = await login("clave-correcta");
    assert.equal(res.status, 200);
    assert.ok((await res.json()).token);
  });
});

describe("correoValido (CP001)", () => {
  it("rechaza formatos inválidos", () => {
    for (const c of ["_@gmail", "_@gmail.com", "ana@", "@x.pe", "a..b@x.pe", ".ana@x.pe", "ana@x", "ana@-x.pe"]) {
      assert.equal(correoValido(c), false, c);
    }
  });
  it("aplica las reglas de Gmail: 6 a 30 caracteres, letras, números y puntos", () => {
    assert.equal(correoValido("axel.calle16@gmail.com"), true);
    assert.equal(correoValido("ana@gmail.com"), false);
    assert.equal(correoValido("ana_calle@gmail.com"), false);
    assert.equal(correoValido(`${"a".repeat(31)}@gmail.com`), false);
  });
  it("acepta correos de otros dominios", () => {
    assert.equal(correoValido("ventas@empresa.com.pe"), true);
    assert.equal(correoValido("alumno@upc.edu.pe"), true);
  });
});
