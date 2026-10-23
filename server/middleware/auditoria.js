// Helper compartido para registrar eventos en AKR_Auditoria
import { sql } from '../db.js';

/**
 * Registra un evento en la tabla AKR_Auditoria.
 * No lanza — los errores de auditoría no deben romper el flujo principal.
 */
export async function registrarAuditoria(pool, idUsuario, emailIntento, evento, detalle, req) {
  try {
    // req.ip respeta 'trust proxy' (solo confía en el proxy de Azure), así que el
    // cliente no puede falsificar su IP enviando un X-Forwarded-For propio
    const ip = (req?.ip ?? req?.socket?.remoteAddress ?? '').slice(0, 45) || null;
    await pool.request()
      .input('idUsuario',    sql.Int,          idUsuario    ?? null)
      .input('emailIntento', sql.NVarChar(150), emailIntento ?? null)
      .input('evento',       sql.NVarChar(60),  evento)
      .input('detalle',      sql.NVarChar(500), detalle      ?? null)
      .input('ip',           sql.NVarChar(45),  ip           ?? null)
      .query(`
        INSERT INTO AKR_Auditoria (Id_Usuario, Email_Intento, Evento, Detalle, IP)
        VALUES (@idUsuario, @emailIntento, @evento, @detalle, @ip)
      `);
  } catch {
    // silencioso — la auditoría no debe interrumpir la operación principal
  }
}
