// Entry point del servidor Express — Ala K' Rico GO API
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import authRoutes          from './routes/auth.js';
import usuariosRoutes      from './routes/usuarios.js';
import pedidosRoutes       from './routes/pedidos.js';
import repartidoresRoutes  from './routes/repartidores.js';
import notificacionesRoutes from './routes/notificaciones.js';
import geocacheRoutes      from './routes/geocache.js';
import auditoriaRoutes     from './routes/auditoria.js';
import reportesRoutes      from './routes/reportes.js';
import configRoutes        from './routes/config.js';
import alertasRoutes       from './routes/alertas.js';
import { registrarAuditoria } from './middleware/auditoria.js';
import { getPool } from './db.js';

dotenv.config();

// S-12 — Validar JWT_SECRET al arranque antes de aceptar conexiones
const _JWT_SECRET = process.env.JWT_SECRET;
if (!_JWT_SECRET || _JWT_SECRET.trim().length < 32) {
  console.error(
    'FATAL: JWT_SECRET no configurado o demasiado corto (mínimo 32 caracteres). ' +
    'Defínelo en server/.env antes de arrancar.'
  );
  process.exit(1);
}

const app  = express();
const PORT = process.env.PORT || 3001;

// Necesario para que rate-limit y el log de auditoría lean la IP real
// detrás de Azure App Service / Vercel proxy
app.set('trust proxy', 1);

// ---------------------------------------------------------------------------
// Rate limiting — C3 fix
// ---------------------------------------------------------------------------
const limiterAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Intente en 15 minutos.' },
});

const limiterGeneral = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

// ---------------------------------------------------------------------------
// Middlewares globales
// ---------------------------------------------------------------------------
app.use(helmet());

// Permite que el frontend cargue recursos de geocache/mapa desde otro origen
app.use('/api/geocache', helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

const ALLOWED_ORIGINS = [
  'http://localhost:8081',
  'http://localhost:5173',
  'https://witty-meadow-0971ee010.4.azurestaticapps.net',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origen no permitido: ${origin}`));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));
app.use(limiterGeneral);

// Prevenir caché en todas las respuestas de la API
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// ---------------------------------------------------------------------------
// Log de accesos no autorizados — CP006 / CP018
// Intercepta 401 después de que el middleware verificarToken responda.
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    if (res.statusCode === 401) {
      // Registrar intento sin token o con token inválido
      getPool().then(pool => {
        const email = req.body?.email ?? null;
        const evento = body?.error === 'Token no proporcionado.'
          ? 'acceso_sin_token'
          : 'token_invalido';
        registrarAuditoria(pool, null, email, evento,
          `${req.method} ${req.path}`, req);
      }).catch(() => {});
    }
    return originalJson(body);
  };
  next();
});

// ---------------------------------------------------------------------------
// Rutas
// ---------------------------------------------------------------------------
app.use('/api/auth',           limiterAuth, authRoutes);
app.use('/api/usuarios',       usuariosRoutes);
app.use('/api/pedidos',        pedidosRoutes);
app.use('/api/repartidores',   repartidoresRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/geocache',       geocacheRoutes);
app.use('/api/auditoria',      auditoriaRoutes);
app.use('/api/reportes',       reportesRoutes);
app.use('/api/config',         configRoutes);
app.use('/api/alertas',        alertasRoutes);

// Endpoint de salud
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, timestamp: new Date() });
});

// ---------------------------------------------------------------------------
// Manejo de errores
// ---------------------------------------------------------------------------
app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada.' });
});

// B-07 — Manejador global de errores Express (4 args = error handler)
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  // SyntaxError de body-parser (JSON malformado)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'JSON malformado en el cuerpo de la solicitud.' });
  }

  // Errores de validación/negocio con status explícito
  if (err.status && err.status < 500) {
    return res.status(err.status).json({ error: err.message || 'Solicitud inválida.' });
  }

  // Error interno — loguear stack completo, respuesta genérica al cliente
  console.error('[ERROR NO CONTROLADO]', err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

// ---------------------------------------------------------------------------
// Inicio del servidor
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
