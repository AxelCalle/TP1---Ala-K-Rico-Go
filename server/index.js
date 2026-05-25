// Entry point del servidor Express — Ala K' Rico GO API
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes     from './routes/auth.js';
import usuariosRoutes from './routes/usuarios.js';

// Cargar variables de entorno desde .env
dotenv.config();

const app  = express();
const PORT = process.env.PORT || 3001;

// ---------------------------------------------------------------------------
// Middlewares globales
// ---------------------------------------------------------------------------
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8080',
  credentials: true,
}));

app.use(express.json());

// ---------------------------------------------------------------------------
// Rutas
// ---------------------------------------------------------------------------
app.use('/api/auth',     authRoutes);
app.use('/api/usuarios', usuariosRoutes);

// Endpoint de salud
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, timestamp: new Date() });
});

// ---------------------------------------------------------------------------
// Manejo de errores
// ---------------------------------------------------------------------------

// Ruta no encontrada (404)
app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada.' });
});

// Error global (500)
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
