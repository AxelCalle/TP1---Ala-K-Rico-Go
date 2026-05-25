// Middleware para verificar el JWT en cada petición protegida
import jwt from 'jsonwebtoken';

/**
 * Verifica que el header Authorization contenga un Bearer token válido.
 * Si es válido, inyecta el payload decodificado en req.usuario.
 * Si falta o es inválido, responde 401.
 */
export function verificarToken(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado.' });
  }
}
