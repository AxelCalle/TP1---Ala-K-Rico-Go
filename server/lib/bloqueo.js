// Bloqueo de la cuenta por intentos fallidos (HU002 / CP006), del lado del servidor:
// se aplica al correo, sin importar el navegador o dispositivo desde el que se intente.
// Se calcula con los eventos login_fallido de AKR_Auditoria: no requiere tablas nuevas.
import { sql } from '../db.js';

export const MAX_INTENTOS = 5;
export const BLOQUEO_MIN = 15;

/**
 * Fallos consecutivos del correo en los últimos 15 minutos (posteriores a su último
 * ingreso exitoso) y segundos que faltan para que venza el bloqueo (0 si no aplica).
 * Los intentos rechazados durante el bloqueo se registran como login_bloqueado y no
 * cuentan: el bloqueo dura 15 minutos desde el quinto fallo.
 */
export async function estadoBloqueo(pool, email) {
  const r = await pool.request()
    .input('email', sql.NVarChar(150), email)
    .input('min',   sql.Int,           BLOQUEO_MIN)
    .query(`
      SELECT COUNT(*) AS fallos,
             DATEDIFF(second, GETDATE(), DATEADD(minute, @min, MAX(a.Timestamp))) AS segundos
      FROM AKR_Auditoria a
      WHERE a.Email_Intento = @email
        AND a.Evento = 'login_fallido'
        AND a.Timestamp > DATEADD(minute, -@min, GETDATE())
        AND a.Timestamp > ISNULL((SELECT MAX(e.Timestamp) FROM AKR_Auditoria e
                                  WHERE e.Email_Intento = @email AND e.Evento = 'login_exitoso'),
                                 '19000101')
    `);
  const { fallos = 0, segundos = 0 } = r.recordset[0] ?? {};
  const bloqueada = fallos >= MAX_INTENTOS && segundos > 0;
  return {
    fallos,
    intentosRestantes: Math.max(0, MAX_INTENTOS - fallos),
    segundosRestantes: bloqueada ? segundos : 0,
  };
}
