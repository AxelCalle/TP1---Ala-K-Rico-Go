// Helper compartido para registrar eventos en AKR_Auditoria
import { sql } from '../db.js';

/**
 * Registra un evento en la tabla AKR_Auditoria.
 * No lanza — los errores de auditoría no deben romper el flujo principal.
 */
export async function registrarAuditoria(pool, idUsuario, emailIntento, evento, detalle, req) {
  try {
    // Tomar solo la primera IP del header (la del cliente real) y truncar a 45 chars
    // para prevenir que un atacante inyecte IPs falsas en el log de auditoría
    const rawForwarded = req?.headers?.['x-forwarded-for'];
    const ip = rawForwarded
      ? String(rawForwarded).split(',')[0].trim().slice(0, 45)
      : (req?.socket?.remoteAddress?.slice(0, 45) ?? null);
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
