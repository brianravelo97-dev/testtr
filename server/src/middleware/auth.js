import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { db } from '../db.js';
import { HttpError } from '../utils/http.js';

export const ROLES = { SUPER: 'super_admin', ADMIN: 'admin', READONLY: 'readonly' };

export function signToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpires });
}

export function verifyToken(token) {
  try { return jwt.verify(token, config.jwtSecret); } catch { return null; }
}

function getBearer(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

/** Requiere sesión de usuario administrador (cualquier rol) */
export function requireUser(req, _res, next) {
  const payload = verifyToken(getBearer(req));
  if (!payload || payload.typ !== 'user') return next(new HttpError(401, 'Sesión inválida o expirada'));
  const user = db().prepare('SELECT id, username, name, email, role, active, pin_hash IS NOT NULL AS has_pin FROM users WHERE id = ?').get(payload.sub);
  if (!user || !user.active) return next(new HttpError(401, 'Usuario deshabilitado'));
  req.user = user;
  next();
}

/** Requiere uno de los roles indicados */
export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return next(new HttpError(403, 'No tiene permisos para esta acción'));
  next();
};

/** Los usuarios "Solo lectura" sólo pueden hacer GET */
export function writeGuard(req, _res, next) {
  if (req.method !== 'GET' && req.user?.role === ROLES.READONLY) {
    return next(new HttpError(403, 'Su rol es de solo lectura'));
  }
  next();
}

/** Requiere sesión de persona (portal de apertura remota) */
export function requirePerson(req, _res, next) {
  const payload = verifyToken(getBearer(req));
  if (!payload || payload.typ !== 'person') return next(new HttpError(401, 'Sesión inválida o expirada'));
  const person = db().prepare('SELECT * FROM people WHERE id = ?').get(payload.sub);
  if (!person || !person.web_access) return next(new HttpError(401, 'Acceso web deshabilitado'));
  req.person = person;
  next();
}
