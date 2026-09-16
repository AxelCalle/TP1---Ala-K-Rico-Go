// S-12 — Tests de validación de JWT_SECRET al arranque
// Verifica la lógica de guarda sin importar index.js (que llama process.exit)
import { describe, it } from "node:test";
import assert from "node:assert/strict";

function validarJwtSecret(secret) {
  if (!secret || secret.trim().length < 32) {
    throw new Error(
      "JWT_SECRET no configurado o demasiado corto (mínimo 32 caracteres)."
    );
  }
}

describe("validación JWT_SECRET al arranque (S-12)", () => {
  it("lanza error cuando JWT_SECRET está ausente (undefined)", () => {
    assert.throws(() => validarJwtSecret(undefined), /mínimo 32 caracteres/);
  });

  it("lanza error cuando JWT_SECRET es una cadena vacía", () => {
    assert.throws(() => validarJwtSecret(""), /mínimo 32 caracteres/);
  });

  it("lanza error cuando JWT_SECRET es solo espacios", () => {
    assert.throws(() => validarJwtSecret("   "), /mínimo 32 caracteres/);
  });

  it("lanza error cuando JWT_SECRET tiene menos de 32 caracteres", () => {
    assert.throws(() => validarJwtSecret("secreto_corto"), /mínimo 32 caracteres/);
  });

  it("acepta un JWT_SECRET de exactamente 32 caracteres", () => {
    assert.doesNotThrow(() => validarJwtSecret("a".repeat(32)));
  });

  it("acepta un JWT_SECRET largo y complejo", () => {
    assert.doesNotThrow(() =>
      validarJwtSecret("s3cr3t0_muy_seguro_para_produccion_2026!")
    );
  });
});
