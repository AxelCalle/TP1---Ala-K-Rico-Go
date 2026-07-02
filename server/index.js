// Entry point del servidor Express — Ala K' Rico GO API
import express from 'express';
import cors from 'cors';
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
import { registrarAuditoria } from './middleware/auditoria.js';
import { getPool } from './db.js';

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 3001;

// ---------------------------------------------------------------------------
// Middlewares globales
// ---------------------------------------------------------------------------
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8081',
  credentials: true,
}));

app.use(express.json());

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
app.use('/api/auth',           authRoutes);
app.use('/api/usuarios',       usuariosRoutes);
app.use('/api/pedidos',        pedidosRoutes);
app.use('/api/repartidores',   repartidoresRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/geocache',       geocacheRoutes);
app.use('/api/auditoria',      auditoriaRoutes);
app.use('/api/reportes',       reportesRoutes);
app.use('/api/config',         configRoutes);

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

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('Error no controlado:', err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

// ---------------------------------------------------------------------------
// Inicio del servidor
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
