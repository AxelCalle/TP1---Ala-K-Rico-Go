// Validaciones de datos compartidas por las rutas (mismas reglas que src/lib/validacion.ts)

// Usuario: empieza y termina en letra o número; dominio con extensión de 2+ letras
const CORREO_RE = /^[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;
// Gmail: 6 a 30 caracteres, solo letras, números y puntos (reglas de Google)
const GMAIL_RE = /^[a-z0-9](?:[a-z0-9.]{4,28})[a-z0-9]$/i;

/** true si el correo tiene un formato válido (y, si es Gmail, cumple sus reglas). */
export function correoValido(email) {
  const correo = String(email ?? '').trim();
  if (correo.length > 150 || !CORREO_RE.test(correo) || correo.includes('..')) return false;
  const [usuario, dominio] = correo.toLowerCase().split('@');
  if (dominio === 'gmail.com' || dominio === 'googlemail.com') return GMAIL_RE.test(usuario);
  return true;
}
