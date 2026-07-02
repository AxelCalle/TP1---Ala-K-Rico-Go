// Rutas de autenticación: login, registro y perfil
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getPool, sql } from '../db.js';
import { verificarToken } from '../middleware/verificarToken.js';
import { registrarAuditoria } from '../middleware/auditoria.js';

const router = Router();

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son obligatorios.' });
  }

  try {
    const pool = await getPool();

    // Buscar usuario activo por email (JOIN con roles para obtener el nombre del rol)
    const result = await pool.request()
      .input('email', sql.NVarChar(150), email)
      .query(`
        SELECT
          u.Id_Usuario,
          u.Nombre_Usuario,
          u.Apellido_Usuario,
          u.Email_Usuario,
          u.Contraseña_Usuario,
          u.Activo_Usuario,
          u.Id_Roles,
          r.Nombre_Role
        FROM AKR_Usuarios u
        INNER JOIN AKR_Roles r ON u.Id_Roles = r.Id_Role
        WHERE u.Email_Usuario = @email
      `);

    const usuario = result.recordset[0];

    // Usuario no encontrado
    if (!usuario) {
      await registrarAuditoria(pool, null, email, 'login_fallido', 'Usuario no encontrado', req);
      return res.status(401).json({ error: 'invalid' });
    }

    // Usuario inactivo
    if (!usuario.Activo_Usuario) {
      await registrarAuditoria(pool, usuario.Id_Usuario, email, 'login_fallido', 'Cuenta inactiva', req);
      return res.status(401).json({ error: 'invalid' });
    }

    // Verificar contraseña
    const passwordValida = await bcrypt.compare(password, usuario.Contraseña_Usuario);
    if (!passwordValida) {
      await registrarAuditoria(pool, usuario.Id_Usuario, email, 'login_fallido', 'Contraseña incorrecta', req);
      return res.status(401).json({ error: 'invalid' });
    }

    // Mapear rol a clave interna
    const nombreRol = (usuario.Nombre_Role || '').toLowerCase();
    let role;
    if (nombreRol.includes('admin')) {
      role = 'admin';
    } else if (nombreRol.includes('repartidor')) {
      role = 'driver';
    } else {
      role = 'customer';
    }

    // Generar JWT
    const payload = {
      id: usuario.Id_Usuario,
      email: usuario.Email_Usuario,
      role,
      idRole: usuario.Id_Roles,
      nombre: usuario.Nombre_Usuario,
      apellido: usuario.Apellido_Usuario,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });

    await registrarAuditoria(pool, usuario.Id_Usuario, email, 'login_exitoso',
      `Rol: ${role}`, req);

    return res.status(200).json({
      token,
      usuario: {
        id: usuario.Id_Usuario,
        nombre: usuario.Nombre_Usuario,
        apellido: usuario.Apellido_Usuario,
        email: usuario.Email_Usuario,
        role,
        idRole: usuario.Id_Roles,
      },
    });
  } catch (err) {
    console.error('Error en /login:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------
router.post('/register', async (req, res) => {
  const { nombre, apellido, email, password, dni, telefono, idRole } = req.body;

  // Validar campos obligatorios
  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios.' });
  }

  try {
    const pool = await getPool();

    // Verificar si el email ya está registrado
    const existeEmail = await pool.request()
      .input('email', sql.NVarChar(150), email)
      .query('SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario = @email');

    if (existeEmail.recordset.length > 0) {
      return res.status(409).json({ error: 'email_taken' });
    }

    // Hashear contraseña
    const saltRounds = 10;
    const hash = await bcrypt.hash(password, saltRounds);

    // Insertar nuevo usuario
    await pool.request()
      .input('idRole',    sql.SmallInt,     idRole    || 3)
      .input('nombre',    sql.NVarChar(100), nombre)
      .input('apellido',  sql.NVarChar(100), apellido  || '')
      .input('email',     sql.NVarChar(150), email)
      .input('hash',      sql.NVarChar(250), hash)
      .input('dni',       sql.NVarChar(9),   dni       || '')
      .input('telefono',  sql.NVarChar(9),   telefono  || '')
      .query(`
        INSERT INTO AKR_Usuarios
          (Id_Roles, Nombre_Usuario, Apellido_Usuario, Email_Usuario,
           Contraseña_Usuario, DNI_Usuario, Telf_Usuario,
           Activo_Usuario, Creacion_Usuario)
        VALUES
          (@idRole, @nombre, @apellido, @email,
           @hash, @dni, @telefono,
           1, GETDATE())
      `);

    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error('Error en /register:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/auth/perfil  (requiere token)
// ---------------------------------------------------------------------------
router.get('/perfil', verificarToken, async (req, res) => {
  try {
    const pool = await getPool();

    const result = await pool.request()
      .input('id', sql.Int, req.usuario.id)
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
    console.error('Error en /perfil:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

export default router;
