import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../db.js';
import { ah, parse, HttpError, notFound } from '../utils/http.js';
import { requireRole, ROLES } from '../middleware/auth.js';
import { audit, diff } from '../services/audit.js';
import { nowLocal } from '../utils/time.js';

/** Gestión de usuarios administradores (sólo Super Admin) */
const r = Router();
r.use(requireRole(ROLES.SUPER));

const COLS = 'id, username, name, email, role, active, last_login, created_at, pin_hash IS NOT NULL AS has_pin';
const password = z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(128)
  .regex(/[A-Z]/, 'La contraseña debe incluir una mayúscula').regex(/[0-9]/, 'La contraseña debe incluir un número');
const base = {
  username: z.string().trim().min(3, 'El usuario debe tener al menos 3 caracteres').max(32).regex(/^[a-zA-Z0-9._-]+$/, 'Usuario: sólo letras, números, punto, guion'),
  name: z.string().trim().min(2, 'Ingrese el nombre').max(100),
  email: z.string().trim().email('Email inválido').max(120).or(z.literal('')).nullable().optional(),
  role: z.enum(['super_admin', 'admin', 'readonly'], { message: 'Rol inválido' }),
  active: z.boolean().optional(),
};
const createSchema = z.object({ ...base, password });
const updateSchema = z.object({ ...base, password: password.or(z.literal('')).optional() });

r.get('/', (_req, res) => {
  res.json(db().prepare(`SELECT ${COLS} FROM users ORDER BY name`).all());
});

r.post('/', ah(async (req, res) => {
  const d = parse(createSchema, req.body);
  if (db().prepare('SELECT 1 FROM users WHERE username = ?').get(d.username)) throw new HttpError(409, 'El nombre de usuario ya existe');
  const info = db().prepare('INSERT INTO users (username, name, email, password_hash, role, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(d.username, d.name, d.email || null, bcrypt.hashSync(d.password, 10), d.role, d.active === false ? 0 : 1, nowLocal(), nowLocal());
  audit(req, 'create', 'user', info.lastInsertRowid, { username: d.username, name: d.name, role: d.role });
  res.status(201).json(db().prepare(`SELECT ${COLS} FROM users WHERE id = ?`).get(info.lastInsertRowid));
}));

r.put('/:id', ah(async (req, res) => {
  const id = Number(req.params.id);
  const before = db().prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!before) throw notFound('Usuario no encontrado');
  const d = parse(updateSchema, req.body);
  if (db().prepare('SELECT 1 FROM users WHERE username = ? AND id <> ?').get(d.username, id)) throw new HttpError(409, 'El nombre de usuario ya existe');
  if (id === req.user.id && (d.role !== ROLES.SUPER || d.active === false)) throw new HttpError(400, 'No puede quitarse a sí mismo el rol de Super Admin ni desactivarse');
  const active = d.active === false ? 0 : 1;
  db().prepare('UPDATE users SET username = ?, name = ?, email = ?, role = ?, active = ?, updated_at = ? WHERE id = ?')
    .run(d.username, d.name, d.email || null, d.role, active, nowLocal(), id);
  if (d.password) db().prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(d.password, 10), id);
  audit(req, 'update', 'user', id, diff(before, { username: d.username, name: d.name, email: d.email || null, role: d.role, active, ...(d.password ? { password: 'x' } : {}) }));
  res.json(db().prepare(`SELECT ${COLS} FROM users WHERE id = ?`).get(id));
}));

r.delete('/:id', ah(async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) throw new HttpError(400, 'No puede eliminar su propio usuario');
  const u = db().prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!u) throw notFound('Usuario no encontrado');
  if (u.role === ROLES.SUPER && db().prepare("SELECT COUNT(*) c FROM users WHERE role = 'super_admin'").get().c <= 1) {
    throw new HttpError(400, 'Debe existir al menos un Super Admin');
  }
  db().prepare('DELETE FROM users WHERE id = ?').run(id);
  audit(req, 'delete', 'user', id, { username: u.username, name: u.name });
  res.json({ ok: true });
}));

export default r;
