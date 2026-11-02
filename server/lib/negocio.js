// Configuración del negocio (AKR_ConfigNegocio): ubicación del local, dirección
// y radio de cobertura. Una fila por instalación (cada pyme tiene la suya).
import { sql } from '../db.js';

/** Valores con los que operaba el sistema; se usan si la tabla aún no existe. */
export const NEGOCIO_DEFECTO = Object.freeze({
  nombre: "Ala K' Rico GO",
  direccion: 'Jr. Áncash 3855, San Martín de Porres 15101 Lima Perú',
  lat: -12.0278455,
  lng: -77.0895871,
  radioKm: 3,
  telefono: null,
});

const RADIO_MAX_KM = 50;
const CACHE_MS = 60_000;
let cache = null; // { datos, t }

/** Valida el cuerpo de PUT /api/config/negocio. Devuelve { datos } o { error }. */
export function validarNegocio(body = {}) {
  const nombre = String(body.nombre ?? '').trim();
  const direccion = String(body.direccion ?? '').trim();
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const radioKm = Number(body.radioKm);
  // Teléfono opcional: dígitos, espacios, guiones y un + inicial; se guarda sin separadores
  const telefonoTxt = String(body.telefono ?? '').trim();
  const telefono = telefonoTxt ? telefonoTxt.replace(/[\s-]/g, '') : null;
  if (nombre.length < 2 || nombre.length > 100) return { error: 'El nombre del local debe tener entre 2 y 100 caracteres.' };
  if (direccion.length < 5 || direccion.length > 300) return { error: 'La dirección debe tener entre 5 y 300 caracteres.' };
  if (body.lat === undefined || body.lat === null || !Number.isFinite(lat) || Math.abs(lat) > 90) return { error: 'Latitud inválida.' };
  if (body.lng === undefined || body.lng === null || !Number.isFinite(lng) || Math.abs(lng) > 180) return { error: 'Longitud inválida.' };
  if (lat === 0 && lng === 0) return { error: 'Fija la ubicación del local en el mapa.' };
  if (!Number.isFinite(radioKm) || radioKm <= 0 || radioKm > RADIO_MAX_KM) {
    return { error: `El radio de cobertura debe estar entre 0,1 y ${RADIO_MAX_KM} km.` };
  }
  if (telefono !== null && !/^\+?\d{6,15}$/.test(telefono)) {
    return { error: 'El teléfono debe tener entre 6 y 15 dígitos (puede empezar con +).' };
  }
  return { datos: { nombre, direccion, lat, lng, radioKm: Math.round(radioKm * 10) / 10, telefono } };
}

/** Lee la configuración (con caché de 60 s). Si la tabla no existe, devuelve la de defecto. */
export async function obtenerNegocio(pool, ahora = Date.now()) {
  if (cache && ahora - cache.t < CACHE_MS) return cache.datos;
  try {
    const r = await pool.request().query(
      'SELECT * FROM AKR_ConfigNegocio WHERE Id = 1',
    );
    const f = r.recordset[0];
    const datos = f
      ? { nombre: f.Nombre_Local, direccion: f.Direccion, lat: f.Lat, lng: f.Lng, radioKm: f.Radio_Km, telefono: f.Telefono ?? null }
      : { ...NEGOCIO_DEFECTO };
    cache = { datos, t: ahora };
    return datos;
  } catch (err) {
    // Migración 002 aún no ejecutada: el sistema sigue operando con los valores de siempre
    console.warn('AKR_ConfigNegocio no disponible, se usan valores por defecto:', err.message);
    return { ...NEGOCIO_DEFECTO };
  }
}

/** Guarda la configuración y renueva la caché. */
export async function guardarNegocio(pool, d) {
  await pool.request()
    .input('nombre', sql.NVarChar(100), d.nombre)
    .input('dir',    sql.NVarChar(300), d.direccion)
    .input('lat',    sql.Float,         d.lat)
    .input('lng',    sql.Float,         d.lng)
    .input('radio',  sql.Float,         d.radioKm)
    .input('tel',    sql.NVarChar(20),  d.telefono)
    .query(`
      MERGE AKR_ConfigNegocio AS t
      USING (SELECT 1 AS Id) AS s ON t.Id = s.Id
      WHEN MATCHED THEN UPDATE SET Nombre_Local = @nombre, Direccion = @dir, Lat = @lat,
                                   Lng = @lng, Radio_Km = @radio, Telefono = @tel, Modificacion = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (Id, Nombre_Local, Direccion, Lat, Lng, Radio_Km, Telefono)
                            VALUES (1, @nombre, @dir, @lat, @lng, @radio, @tel);
    `);
  cache = { datos: { ...d }, t: Date.now() };
}

/** Solo para tests. */
export function _limpiarCache() {
  cache = null;
}
