// Rutas de autenticación: login, registro y perfil
import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getPool, sql } from '../db.js';
import { verificarToken } from '../middleware/verificarToken.js';
import { registrarAuditoria } from '../middleware/auditoria.js';
import { estadoBloqueo } from '../lib/bloqueo.js';
import { correoValido } from '../lib/validacion.js';

const router = Router();

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
router.post('/login', async (req, res) => {
  const { password } = req.body;
  const email = String(req.body.email ?? '').trim().toLowerCase();

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son obligatorios.' });
  }

  // Bloqueo por cuenta (HU002 / CP006): vale para cualquier navegador o dispositivo.
  // Si la consulta falla, el ingreso no se interrumpe (queda el límite por IP).
  const bloqueo = async (pool) => {
    try {
      return await estadoBloqueo(pool, email);
    } catch (err) {
      console.error('Bloqueo de cuenta:', err.message);
      return null;
    }
  };
  const bloqueada = (res, segundosRestantes) =>
    res.status(423).json({ error: 'cuenta_bloqueada', segundosRestantes });
  // Credenciales incorrectas: 401 con los intentos que quedan, o 423 si este fue el quinto
  const fallo = async (pool, idUsuario, detalle) => {
    await registrarAuditoria(pool, idUsuario, email, 'login_fallido', detalle, req);
    const estado = await bloqueo(pool);
    if (estado?.segundosRestantes > 0) return bloqueada(res, estado.segundosRestantes);
    return res.status(401).json({ error: 'invalid', intentosRestantes: estado?.intentosRestantes });
  };

  try {
    const pool = await getPool();

    const previo = await bloqueo(pool);
    if (previo?.segundosRestantes > 0) {
      // No cuenta como fallo: el bloqueo dura 15 min desde el quinto intento
      await registrarAuditoria(pool, null, email, 'login_bloqueado', 'Cuenta bloqueada por intentos fallidos', req);
      return bloqueada(res, previo.segundosRestantes);
    }

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
    if (!usuario) return fallo(pool, null, 'Usuario no encontrado');

    // Usuario inactivo
    if (!usuario.Activo_Usuario) return fallo(pool, usuario.Id_Usuario, 'Cuenta inactiva');

    // Verificar contraseña
    const passwordValida = await bcrypt.compare(password, usuario.Contraseña_Usuario);
    if (!passwordValida) return fallo(pool, usuario.Id_Usuario, 'Contraseña incorrecta');

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
  const { nombre, apellido, email, password, dni, telefono } = req.body;

  // Validación de campos obligatorios y longitudes
  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios.' });
  }
  const nombreTrim = String(nombre).trim();
  const emailTrim  = String(email).trim().toLowerCase();
  if (nombreTrim.length < 2 || nombreTrim.length > 100) {
    return res.status(400).json({ error: 'El nombre debe tener entre 2 y 100 caracteres.' });
  }
  if (!correoValido(emailTrim) || emailTrim.length > 150) {
    return res.status(400).json({ error: 'Email inválido.' });
  }
  if (password.length < 8 || password.length > 100) {
    return res.status(400).json({ error: 'La contraseña debe tener entre 8 y 100 caracteres.' });
  }

  // idRole siempre es 3 (Cliente) — ignorar cualquier valor enviado por el cliente
  const idRoleForzado = 3;

  try {
    const pool = await getPool();

    const existeEmail = await pool.request()
      .input('email', sql.NVarChar(150), emailTrim)
      .query('SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario = @email');

    if (existeEmail.recordset.length > 0) {
      return res.status(409).json({ error: 'email_taken' });
    }

    const hash = await bcrypt.hash(password, 10);

    const insertRes = await pool.request()
      .input('idRole',    sql.SmallInt,     idRoleForzado)
      .input('nombre',    sql.NVarChar(100), nombreTrim)
      .input('apellido',  sql.NVarChar(100), apellido ? String(apellido).trim().slice(0, 100) : '')
      .input('email',     sql.NVarChar(150), emailTrim)
      .input('hash',      sql.NVarChar(250), hash)
      .input('dni',       sql.NVarChar(9),   dni       ? String(dni).trim().slice(0, 9)   : '')
      .input('telefono',  sql.NVarChar(20),  telefono  ? String(telefono).trim().slice(0, 20) : '')
      .query(`
        INSERT INTO AKR_Usuarios
          (Id_Roles, Nombre_Usuario, Apellido_Usuario, Email_Usuario,
           Contraseña_Usuario, DNI_Usuario, Telf_Usuario,
           Activo_Usuario, Creacion_Usuario)
        OUTPUT INSERTED.Id_Usuario
        VALUES
          (@idRole, @nombre, @apellido, @email,
           @hash, @dni, @telefono,
           1, GETDATE())
      `);

    const nuevoId = insertRes.recordset[0]?.Id_Usuario ?? null;
    await registrarAuditoria(pool, nuevoId, emailTrim, 'registro_usuario', 'Registro exitoso', req);

    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error('Error en /register:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/change-password  (requiere token — usuario logueado)
// ---------------------------------------------------------------------------
router.post('/change-password', verificarToken, async (req, res) => {
  const { passwordActual, passwordNuevo } = req.body;
  if (!passwordActual || !passwordNuevo) {
    return res.status(400).json({ error: 'Campos incompletos.' });
  }
  if (passwordNuevo.length < 8 || passwordNuevo.length > 100) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener entre 8 y 100 caracteres.' });
  }
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.usuario.id)
      .query('SELECT Contraseña_Usuario FROM AKR_Usuarios WHERE Id_Usuario = @id');
    const usuario = result.recordset[0];
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado.' });
    const valida = await bcrypt.compare(passwordActual, usuario.Contraseña_Usuario);
    if (!valida) return res.status(401).json({ error: 'password_incorrecto' });
    const hash = await bcrypt.hash(passwordNuevo, 10);
    await pool.request()
      .input('id',   sql.Int,          req.usuario.id)
      .input('hash', sql.NVarChar(250), hash)
      .query('UPDATE AKR_Usuarios SET Contraseña_Usuario = @hash, Modificacion_Usuario = GETDATE() WHERE Id_Usuario = @id');
    await registrarAuditoria(pool, req.usuario.id, req.usuario.email, 'cambio_password', 'Cambio exitoso', req);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Error en /change-password:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/reset-password  (sin token — solo habilitado en modo piloto)
// ADVERTENCIA DE SEGURIDAD: este endpoint no valida identidad mediante OTP ni
// enlace de correo. En producción real debe deshabilitarse y reemplazarse por
// un flujo de verificación por email. Dejado activo únicamente para la fase
// piloto de la tesis con datos controlados.
// ---------------------------------------------------------------------------
router.post('/reset-password', async (req, res) => {
  if (process.env.NODE_ENV === 'production' && process.env.PILOTO_RESET !== 'true') {
    return res.status(403).json({ error: 'Función no disponible.' });
  }

  const { email, passwordNuevo } = req.body;
  if (!email || !passwordNuevo) {
    return res.status(400).json({ error: 'Campos incompletos.' });
  }
  const emailTrim = String(email).trim().toLowerCase();
  if (!correoValido(emailTrim)) {
    return res.status(400).json({ error: 'Email inválido.' });
  }
  if (passwordNuevo.length < 8 || passwordNuevo.length > 100) {
    return res.status(400).json({ error: 'La contraseña debe tener entre 8 y 100 caracteres.' });
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('email', sql.NVarChar(150), emailTrim)
      .query('SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario = @email AND Activo_Usuario = 1');
    // Respuesta genérica para no revelar si el email existe
    if (result.recordset.length === 0) {
      return res.status(200).json({ ok: true });
    }
    const id = result.recordset[0].Id_Usuario;
    const hash = await bcrypt.hash(passwordNuevo, 10);
    await pool.request()
      .input('id',   sql.Int,          id)
      .input('hash', sql.NVarChar(250), hash)
      .query('UPDATE AKR_Usuarios SET Contraseña_Usuario = @hash, Modificacion_Usuario = GETDATE() WHERE Id_Usuario = @id');
    await registrarAuditoria(pool, id, emailTrim, 'reset_password', 'Reset sin token (piloto)', req);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Error en /reset-password:', err.message);
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

// ---------------------------------------------------------------------------
// PUT /api/auth/perfil  — el propio usuario actualiza sus datos
// ---------------------------------------------------------------------------
router.put('/perfil', verificarToken, async (req, res) => {
  const { nombre, apellido, dni, telefono } = req.body;

  if (nombre !== undefined) {
    const n = String(nombre).trim();
    if (n.length < 2 || n.length > 100)
      return res.status(400).json({ error: 'El nombre debe tener entre 2 y 100 caracteres.' });
  }
  if (apellido !== undefined && String(apellido).trim().length > 100)
    return res.status(400).json({ error: 'El apellido no puede superar 100 caracteres.' });
  if (dni !== undefined && !/^\d{8,9}$/.test(String(dni).trim()))
    return res.status(400).json({ error: 'El DNI debe tener 8 o 9 dígitos.' });
  if (telefono !== undefined && !/^\d{7,20}$/.test(String(telefono).trim()))
    return res.status(400).json({ error: 'El teléfono debe tener entre 7 y 20 dígitos.' });

  try {
    const pool = await getPool();
    await pool.request()
      .input('id',       sql.Int,          req.usuario.id)
      .input('nombre',   sql.NVarChar(100), nombre   ?? null)
      .input('apellido', sql.NVarChar(100), apellido ?? null)
      .input('dni',      sql.NVarChar(20),  dni      ?? null)
      .input('telefono', sql.NVarChar(20),  telefono ?? null)
      .query(`
        UPDATE AKR_Usuarios
        SET
          Nombre_Usuario       = COALESCE(@nombre,   Nombre_Usuario),
          Apellido_Usuario     = COALESCE(@apellido, Apellido_Usuario),
          DNI_Usuario          = COALESCE(@dni,      DNI_Usuario),
          Telf_Usuario         = COALESCE(@telefono, Telf_Usuario),
          Modificacion_Usuario = GETDATE()
        WHERE Id_Usuario = @id
      `);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Error en PUT /perfil:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/auth/cuenta  — el cliente elimina su propia cuenta (App Store / Google Play)
// Body: { password }. No borra la fila: los pedidos históricos alimentan los
// reportes del piloto y las calificaciones. Se anonimiza en una transacción:
// datos personales, contraseña, notificaciones y direcciones escritas de sus
// pedidos; la cuenta queda inactiva y el email libre para un registro nuevo.
// ---------------------------------------------------------------------------
router.delete('/cuenta', verificarToken, async (req, res) => {
  if (req.usuario.role !== 'customer') {
    return res.status(403).json({ error: 'Solo los clientes pueden eliminar su cuenta desde la app. Contacta al administrador.' });
  }
  const { password } = req.body ?? {};
  if (!password) return res.status(400).json({ error: 'Ingresa tu contraseña para confirmar.' });

  try {
    const pool = await getPool();
    const actual = await pool.request()
      .input('id', sql.Int, req.usuario.id)
      .query('SELECT Contraseña_Usuario, Activo_Usuario FROM AKR_Usuarios WHERE Id_Usuario = @id');
    const usuario = actual.recordset[0];
    if (!usuario || !usuario.Activo_Usuario) return res.status(404).json({ error: 'Cuenta no encontrada.' });
    if (!(await bcrypt.compare(password, usuario.Contraseña_Usuario))) {
      return res.status(401).json({ error: 'password_incorrecto' });
    }

    // Un pedido en reparto no se puede abandonar: primero debe entregarse
    const enCurso = await pool.request()
      .input('id', sql.Int, req.usuario.id)
      .query(`SELECT COUNT(*) AS total FROM AKR_Pedidos
              WHERE Id_Cliente = @id AND Estado IN ('asignado','en_camino')`);
    if (enCurso.recordset[0].total > 0) {
      return res.status(409).json({ error: 'Tienes un pedido en reparto. Podrás eliminar tu cuenta cuando se entregue.' });
    }

    const hashInutil = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
    await pool.request()
      .input('id',    sql.Int,           req.usuario.id)
      .input('email', sql.NVarChar(150), `eliminado-${req.usuario.id}@cuenta-eliminada.invalid`)
      .input('hash',  sql.NVarChar(250), hashInutil)
      .query(`
        SET XACT_ABORT ON;
        BEGIN TRANSACTION;
          UPDATE AKR_Pedidos
             SET Estado = 'cancelado', Cancelacion_Pedido = GETDATE()
           WHERE Id_Cliente = @id AND Estado = 'sin_asignar';
          UPDATE AKR_Pedidos
             SET Direccion_Destino = 'Dirección eliminada por el titular'
           WHERE Id_Cliente = @id;
          DELETE FROM AKR_Notificaciones WHERE Id_Cliente = @id;
          UPDATE AKR_Usuarios
             SET Nombre_Usuario = 'Cuenta eliminada', Apellido_Usuario = '',
                 Email_Usuario = @email, Contraseña_Usuario = @hash,
                 DNI_Usuario = NULL, Telf_Usuario = NULL,
                 Activo_Usuario = 0, Modificacion_Usuario = GETDATE()
           WHERE Id_Usuario = @id;
        COMMIT TRANSACTION;
      `);
    // Sin email en la auditoría: solo el Id (ya anonimizado)
    await registrarAuditoria(pool, req.usuario.id, null, 'cuenta_eliminada', 'Eliminada por el titular', req);
    return res.json({ ok: true });
  } catch (err) {
    console.error('Error en DELETE /cuenta:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

export default router;
