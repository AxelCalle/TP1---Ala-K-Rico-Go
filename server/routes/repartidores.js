// Rutas de repartidores (GPS, listado, alta por admin)
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getPool, sql } from '../db.js';
import { verificarToken } from '../middleware/verificarToken.js';
import { registrarAuditoria } from '../middleware/auditoria.js';

const router = Router();
router.use(verificarToken);

// GET /api/repartidores  — admin: todos; driver: solo su propio perfil
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();

    if (req.usuario.role === 'admin') {
      const result = await pool.request().query(`
        SELECT
          u.Id_Usuario, u.Nombre_Usuario, u.Apellido_Usuario,
          u.Email_Usuario, u.DNI_Usuario, u.Telf_Usuario, u.Activo_Usuario,
          ub.Lat, ub.Lng, ub.Actualizado AS Ubicacion_Actualizado
        FROM AKR_Usuarios u
        LEFT JOIN AKR_Ubicaciones ub ON u.Id_Usuario = ub.Id_Repartidor
        WHERE u.Id_Roles = 2
        ORDER BY u.Nombre_Usuario
      `);
      return res.json(result.recordset);
    }

    // driver: solo su propio registro
    const result = await pool.request()
      .input('id', sql.Int, req.usuario.id)
      .query(`
        SELECT
          u.Id_Usuario, u.Nombre_Usuario, u.Apellido_Usuario,
          u.Email_Usuario, u.DNI_Usuario, u.Telf_Usuario,
          ub.Lat, ub.Lng, ub.Actualizado AS Ubicacion_Actualizado
        FROM AKR_Usuarios u
        LEFT JOIN AKR_Ubicaciones ub ON u.Id_Usuario = ub.Id_Repartidor
        WHERE u.Id_Usuario = @id
      `);
    return res.json(result.recordset[0] ?? null);
  } catch (err) {
    console.error('GET /repartidores:', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

// POST /api/repartidores  — admin crea un repartidor
router.post('/', async (req, res) => {
  if (req.usuario.role !== 'admin') {
    return res.status(403).json({ error: 'Solo admin puede crear repartidores.' });
  }

  const { nombre, apellido, email, dni, telefono } = req.body;
  if (!nombre || !email || !dni) {
    return res.status(400).json({ error: 'nombre, email y DNI son obligatorios.' });
  }

  // Contraseña automática: primerNombre + últimas 4 del DNI
  const primerNombre = nombre.trim().split(' ')[0].toLowerCase();
  const ultimas4     = (dni || '').slice(-4);
  const passwordAuto = `${primerNombre}.${ultimas4}`;

  try {
    const pool = await getPool();

    const existe = await pool.request()
      .input('email', sql.NVarChar(150), email)
      .query('SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario = @email');
    if (existe.recordset.length > 0) {
      return res.status(409).json({ error: 'email_taken' });
    }

    const hash = await bcrypt.hash(passwordAuto, 10);

    const result = await pool.request()
      .input('nombre',   sql.NVarChar(100), nombre)
      .input('apellido', sql.NVarChar(100), apellido || '')
      .input('email',    sql.NVarChar(150), email)
      .input('hash',     sql.NVarChar(250), hash)
      .input('dni',      sql.NVarChar(9),   dni || '')
      .input('tel',      sql.NVarChar(9),   telefono || '')
      .query(`
        INSERT INTO AKR_Usuarios
          (Id_Roles, Nombre_Usuario, Apellido_Usuario, Email_Usuario,
           Contraseña_Usuario, DNI_Usuario, Telf_Usuario, Activo_Usuario, Creacion_Usuario)
        OUTPUT INSERTED.Id_Usuario
        VALUES (2, @nombre, @apellido, @email, @hash, @dni, @tel, 1, GETDATE())
      `);

    const id = result.recordset[0].Id_Usuario;
    await registrarAuditoria(pool, req.usuario.id, null, 'repartidor_creado',
      `Repartidor ${email} creado por admin ${req.usuario.id}`, req);

    return res.status(201).json({ ok: true, id, passwordAuto });
  } catch (err) {
    console.error('POST /repartidores:', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

// PUT /api/repartidores/:id  — admin edita datos de un repartidor
router.put('/:id', async (req, res) => {
  if (req.usuario.role !== 'admin') return res.status(403).json({ error: 'Solo admin.' });
  const { nombre, apellido, email, dni, telefono } = req.body;
  if (!nombre || !email) return res.status(400).json({ error: 'nombre y email son obligatorios.' });
  try {
    const pool = await getPool();
    await pool.request()
      .input('id',       sql.Int,          parseInt(req.params.id))
      .input('nombre',   sql.NVarChar(100), nombre)
      .input('apellido', sql.NVarChar(100), apellido || '')
      .input('email',    sql.NVarChar(150), email)
      .input('dni',      sql.NVarChar(9),   dni || '')
      .input('tel',      sql.NVarChar(9),   telefono || '')
      .query(`UPDATE AKR_Usuarios SET
        Nombre_Usuario=@nombre, Apellido_Usuario=@apellido,
        Email_Usuario=@email, DNI_Usuario=@dni, Telf_Usuario=@tel,
        Modificacion_Usuario=GETDATE()
        WHERE Id_Usuario=@id AND Id_Roles=2`);
    return res.json({ ok: true });
  } catch (err) {
    console.error('PUT /repartidores/:id:', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

// PATCH /api/repartidores/:id/toggle  — activar/desactivar
router.patch('/:id/toggle', async (req, res) => {
  if (req.usuario.role !== 'admin') {
    return res.status(403).json({ error: 'Solo admin.' });
  }
  try {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, parseInt(req.params.id))
      .query(`
        UPDATE AKR_Usuarios SET
          Activo_Usuario       = CASE WHEN Activo_Usuario = 1 THEN 0 ELSE 1 END,
          Modificacion_Usuario = GETDATE()
        WHERE Id_Usuario = @id AND Id_Roles = 2
      `);
    return res.json({ ok: true });
  } catch (err) {
    console.error('PATCH /repartidores/:id/toggle:', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

// PUT /api/repartidores/:id/ubicacion  — repartidor actualiza su GPS (CP052-054)
router.put('/:id/ubicacion', async (req, res) => {
  const idParam = parseInt(req.params.id);

  // Solo el propio repartidor o admin pueden actualizar
  if (req.usuario.role !== 'admin' && req.usuario.id !== idParam) {
    return res.status(403).json({ error: 'Acceso denegado.' });
  }

  const { lat, lng } = req.body;
  if (lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'lat y lng son obligatorios.' });
  }

  try {
    const pool = await getPool();

    // UPSERT: actualiza si existe, inserta si no
    await pool.request()
      .input('id',  sql.Int,   idParam)
      .input('lat', sql.Float, lat)
      .input('lng', sql.Float, lng)
      .query(`
        MERGE AKR_Ubicaciones AS target
        USING (SELECT @id AS Id_Repartidor) AS source
          ON target.Id_Repartidor = source.Id_Repartidor
        WHEN MATCHED THEN
          UPDATE SET Lat = @lat, Lng = @lng, Actualizado = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (Id_Repartidor, Lat, Lng) VALUES (@id, @lat, @lng);
      `);

    return res.json({ ok: true });
  } catch (err) {
    console.error('PUT /repartidores/:id/ubicacion:', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

// GET /api/repartidores/:id/ubicacion  — consulta GPS de un repartidor
router.get('/:id/ubicacion', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, parseInt(req.params.id))
      .query('SELECT Lat, Lng, Actualizado FROM AKR_Ubicaciones WHERE Id_Repartidor = @id');

    if (!result.recordset[0]) {
      return res.status(404).json({ error: 'Ubicación no disponible.' });
    }
    return res.json(result.recordset[0]);
  } catch (err) {
    console.error('GET /repartidores/:id/ubicacion:', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

export default router;
