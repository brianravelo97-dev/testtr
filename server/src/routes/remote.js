import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../db.js';
import { ah, parse, HttpError } from '../utils/http.js';
import { isValidRut, normalizeRut } from '../utils/rut.js';
import { signToken, requirePerson } from '../middleware/auth.js';
import { loginLimiter, openLimiter } from '../middleware/rateLimits.js';
import { doorsForPerson, evaluateAccess } from '../services/access.js';
import { createOpenToken, consumeOpenToken } from '../services/remoteOpen.js';
import { publicPerson } from './people.js';

/** Portal de apertura remota para personas (desde el celular) */
const r = Router();

r.post('/login', loginLimiter, ah(async (req, res) => {
  const { rut, password } = parse(z.object({
    rut: z.string().trim().min(1, 'Ingrese su RUT').max(15),
    password: z.string().min(1, 'Ingrese su contraseña').max(128),
  }), req.body);
  const p = isValidRut(rut) ? db().prepare('SELECT * FROM people WHERE rut = ?').get(normalizeRut(rut)) : null;
  const ok = bcrypt.compareSync(password, p?.web_password_hash || '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
  if (!p || !ok || !p.web_access) throw new HttpError(401, 'RUT o contraseña incorrectos, o sin acceso web habilitado');
  if (p.status !== 'active') throw new HttpError(403, 'Su acceso se encuentra suspendido');
  res.json({ token: signToken({ sub: p.id, typ: 'person' }), person: publicPerson(p) });
}));

r.get('/me', requirePerson, (req, res) => res.json({ person: publicPerson(req.person) }));

/** Puertas asignadas, indicando si en este momento se pueden abrir */
r.get('/doors', requirePerson, (req, res) => {
  const now = new Date();
  res.json(doorsForPerson(req.person.id).map((d) => {
    const ev = evaluateAccess(req.person, d.id, now);
    return { id: d.id, name: d.name, location: d.location, allowed: ev.granted, reason: ev.granted ? null : ev.reason };
  }));
});

r.post('/token', requirePerson, openLimiter, ah(async (req, res) => {
  const { door_id } = parse(z.object({ door_id: z.number().int() }), req.body);
  res.json(createOpenToken({ type: 'person', person: req.person }, door_id));
}));

r.post('/open', requirePerson, openLimiter, ah(async (req, res) => {
  const { token, pin } = parse(z.object({
    token: z.string().min(10).max(100),
    pin: z.string().regex(/^\d{6}$/, 'El PIN debe tener 6 dígitos'),
  }), req.body);
  const out = await consumeOpenToken({ type: 'person', person: req.person }, token, pin);
  res.json({ ok: true, message: out.message });
}));

export default r;
