import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../db.js';
import { ah, parse, HttpError } from '../utils/http.js';
import { signToken, requireUser } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rateLimits.js';
import { audit } from '../services/audit.js';
import { nowLocal } from '../utils/time.js';

const r = Router();

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Ingrese su usuario').max(64),
  password: z.string().min(1, 'Ingrese su contraseña').max(128),
});

r.post('/login', loginLimiter, ah(async (req, res) => {
  const { username, password } = parse(loginSchema, req.body);
  const user = db().prepare('SELECT * FROM users WHERE username = ?').get(username);
  // compara siempre para no revelar si el usuario existe (tiempo constante aproximado)
  const ok = bcrypt.compareSync(password, user?.password_hash || '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
  if (!user || !ok || !user.active) {
    audit({ ip: req.ip, user: { username } }, 'login_failed', 'auth', null, { username });
    throw new HttpError(401, 'Usuario o contraseña incorrectos');
  }
  db().prepare('UPDATE users SET last_login = ? WHERE id = ?').run(nowLocal(), user.id);
  const token = signToken({ sub: user.id, typ: 'user', role: user.role });
  audit({ ip: req.ip, user }, 'login', 'auth', user.id);
  res.json({ token, user: { id: user.id, username: user.username, name: user.name, role: user.role, has_pin: !!user.pin_hash } });
}));

r.get('/me', requireUser, (req, res) => res.json({ user: { ...req.user, has_pin: !!req.user.has_pin } }));

const pwdSchema = z.object({
  current_password: z.string().min(1, 'Ingrese su contraseña actual'),
  new_password: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres').max(128)
    .regex(/[A-Z]/, 'Debe incluir una mayúscula').regex(/[0-9]/, 'Debe incluir un número'),
});

r.post('/change-password', requireUser, loginLimiter, ah(async (req, res) => {
  const data = parse(pwdSchema, req.body);
  const u = db().prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(data.current_password, u.password_hash)) throw new HttpError(400, 'La contraseña actual es incorrecta');
  db().prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(bcrypt.hashSync(data.new_password, 10), nowLocal(), req.user.id);
  audit(req, 'update', 'user', req.user.id, { campo: 'contraseña' });
  res.json({ ok: true });
}));

const pinSchema = z.object({
  current_password: z.string().min(1, 'Ingrese su contraseña'),
  pin: z.string().regex(/^\d{6}$/, 'El PIN debe tener exactamente 6 dígitos').nullable(),
});

/** Configura (o elimina con pin=null) el PIN de 6 dígitos del administrador */
r.post('/pin', requireUser, loginLimiter, ah(async (req, res) => {
  const data = parse(pinSchema, req.body);
  const u = db().prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(data.current_password, u.password_hash)) throw new HttpError(400, 'La contraseña es incorrecta');
  db().prepare('UPDATE users SET pin_hash = ?, updated_at = ? WHERE id = ?').run(data.pin ? bcrypt.hashSync(data.pin, 10) : null, nowLocal(), req.user.id);
  audit(req, 'update', 'user', req.user.id, { campo: data.pin ? 'PIN configurado' : 'PIN eliminado' });
  res.json({ ok: true, has_pin: !!data.pin });
}));

export default r;
