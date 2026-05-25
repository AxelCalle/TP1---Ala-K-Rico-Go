// Rutas de gestión de usuarios (solo administradores)
import { Router } from 'express';
import { getPool, sql } from '../db.js';
import { verificarToken } from '../middleware/verificarToken.js';

const router = Router();

// ---------------------------------------------------------------------------
// Middleware local: solo rol 'admin'
// ---------------------------------------------------------------------------
function soloAdmin(req, res, next) {
  if (req.usuario?.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol administrador.' });
  }
  next();
}

// Aplicar verificación de token y rol admin a todas las rutas de este router
router.use(verificarToken, soloAdmin);

// ---------------------------------------------------------------------------
// GET /api/usuarios  — lista todos los usuarios (sin contraseñas)
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();

    const result = await pool.request().query(`
      SELECT
        u.Id_Usuario,
        u.Nombre_Usuario,
        u.Apellido_Usuario,
        u.Email_Usuario,
        u.DNI_Usuario,
        u.Telf_Usuario,
        u.Activo_Usuario,
        u.Creacion_Usuario,
        u.Modificacion_Usuario,
        u.Id_Roles,
        r.Nombre_Role,
        r.Descripcion_Role
      FROM AKR_Usuarios u
      INNER JOIN AKR_Roles r ON u.Id_Roles = r.Id_Role
      ORDER BY u.Id_Usuario
    `);

    return res.status(200).json(result.recordset);
  } catch (err) {
    console.error('Error en GET /usuarios:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/usuarios/:id  — un usuario por ID
// ---------------------------------------------------------------------------
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const pool = await getPool();

    const result = await pool.request()
      .input('id', sql.Int, parseInt(id))
      .query(`
        SELECT
          u.Id_Usuario,
          u.Nombre_Usuario,
          u.Apellido_Usuario,
          u.Email_Usuario,
          u.DNI_Usuario,
          u.Telf_Usuario,
          u.Activo_Usuario,
          u.Creacion_Usuario,
          u.Modificacion_Usuario,
          u.Id_Roles,
          r.Nombre_Role,
          r.Descripcion_Role
        FROM AKR_Usuarios u
        INNER JOIN AKR_Roles r ON u.Id_Roles = r.Id_Role
        WHERE u.Id_Usuario = @id
      `);

    const usuario = result.recordset[0];
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    return res.status(200).json(usuario);
  } catch (err) {
    console.error('Error en GET /usuarios/:id:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/usuarios/:id  — actualiza datos del usuario
// ---------------------------------------------------------------------------
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, apellido, dni, telefono } = req.body;

  try {
    const pool = await getPool();

    await pool.request()
      .input('id',        sql.Int,          parseInt(id))
      .input('nombre',    sql.NVarChar(100), nombre    ?? null)
      .input('apellido',  sql.NVarChar(100), apellido  ?? null)
      .input('dni',       sql.NVarChar(9),   dni       ?? null)
      .input('telefono',  sql.NVarChar(9),   telefono  ?? null)
      .query(`
        UPDATE AKR_Usuarios
        SET
          Nombre_Usuario        = COALESCE(@nombre,   Nombre_Usuario),
          Apellido_Usuario      = COALESCE(@apellido, Apellido_Usuario),
          DNI_Usuario           = COALESCE(@dni,      DNI_Usuario),
          Telf_Usuario          = COALESCE(@telefono, Telf_Usuario),
          Modificacion_Usuario  = GETDATE()
        WHERE Id_Usuario = @id
      `);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Error en PUT /usuarios/:id:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/usuarios/:id/toggle  — activa / desactiva un usuario
// ---------------------------------------------------------------------------
router.patch('/:id/toggle', async (req, res) => {
  const { id } = req.params;

  try {
    const pool = await getPool();

    await pool.request()
      .input('id', sql.Int, parseInt(id))
      .query(`
        UPDATE AKR_Usuarios
        SET
          Activo_Usuario       = CASE WHEN Activo_Usuario = 1 THEN 0 ELSE 1 END,
          Modificacion_Usuario = GETDATE()
        WHERE Id_Usuario = @id
      `);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Error en PATCH /usuarios/:id/toggle:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

export default router;
