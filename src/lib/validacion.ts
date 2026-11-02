// Validaciones de formularios (mismas reglas que server/lib/validacion.js)

// Usuario: empieza y termina en letra o número; dominio con extensión de 2+ letras
const CORREO_RE =
  /^[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;
// Gmail: 6 a 30 caracteres, solo letras, números y puntos (reglas de Google)
const GMAIL_RE = /^[a-z0-9](?:[a-z0-9.]{4,28})[a-z0-9]$/i;

/** true si el correo tiene un formato válido (y, si es Gmail, cumple sus reglas). */
export function correoValido(email: string): boolean {
  const correo = email.trim();
  if (correo.length > 150 || !CORREO_RE.test(correo) || correo.includes("..")) return false;
  const [usuario, dominio] = correo.toLowerCase().split("@");
  if (dominio === "gmail.com" || dominio === "googlemail.com") return GMAIL_RE.test(usuario);
  return true;
}

/** Mensaje para un correo inválido: explica la regla de Gmail cuando aplica. */
export function errorCorreo(email: string): string {
  return /@(gmail|googlemail)\.com$/i.test(email.trim())
    ? "Correo de Gmail inválido: el usuario debe tener de 6 a 30 caracteres (letras, números y puntos) y empezar y terminar en letra o número."
    : "Ingresa un correo electrónico válido (ejemplo: nombre@gmail.com).";
}

/** Celular peruano de 9 dígitos (el cliente llama al repartidor desde el seguimiento). */
export const TELEFONO_RE = /^9\d{8}$/;
export const ERROR_TELEFONO = "El teléfono debe ser un celular de 9 dígitos que empiece en 9.";
