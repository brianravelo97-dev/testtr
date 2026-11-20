import { Router } from 'express';
import { z } from 'zod';
import { db, getSetting } from '../db.js';
import { ah, parse, notFound, forbidden } from '../utils/http.js';
import { audit, diff } from '../services/audit.js';
import { createOpenToken, consumeOpenToken } from '../services/remoteOpen.js';
import { openLimiter } from '../middleware/rateLimits.js';
import { nowLocal } from '../utils/time.js';

const r = Router();

const schema = z.object({
  name: z.string().trim().min(2, 'Ingrese el nombre de la puerta').max(80),
  location: z.string().trim().max(120).nullable().optional().transform((v) => v || null),
  lock_type: z.enum(['fail_safe', 'fail_secure'], { message: 'Tipo de chapa inválido' }),
  device_id: z.union([z.number().int(), z.null(), z.literal('')]).optional().transform((v) => (v === '' || v == null ? null : v)),
  relay_number: z.number().int().min(1).max(16).default(1),
  open_seconds: z.number().int().min(1, 'Mínimo 1 segundo').max(60, 'Máximo 60 segundos').default(3),
});

const SELECT = `SELECT d.*, dv.name AS device_name, dv.status AS device_status, dv.driver AS device_driver,
  (SELECT COUNT(*) FROM group_doors gd WHERE gd.door_id = d.id) AS group_count
  FROM doors d LEFT JOIN devices dv ON dv.id = d.device_id`;

r.get('/', (_req, res) => res.json(db().prepare(`${SELECT} ORDER BY d.name`).all()));

r.get('/:id', (req, res) => {
  const d = db().prepare(`${SELECT} WHERE d.id = ?`).get(Number(req.params.id));
  if (!d) throw notFound('Puerta no encontrada');
  res.json(d);
});

r.post('/', ah(async (req, res) => {
  const d = parse(schema, req.body);
  const info = db().prepare('INSERT INTO doors (name, location, lock_type, device_id, relay_number, open_seconds, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(d.name, d.location, d.lock_type, d.device_id, d.relay_number, d.open_seconds, nowLocal(), nowLocal());
  audit(req, 'create', 'door', info.lastInsertRowid, d);
  res.status(201).json(db().prepare(`${SELECT} WHERE d.id = ?`).get(info.lastInsertRowid));
}));

r.put('/:id', ah(async (req, res) => {
  const id = Number(req.params.id);
  const before = db().prepare('SELECT * FROM doors WHERE id = ?').get(id);
  if (!before) throw notFound('Puerta no encontrada');
  const d = parse(schema, req.body);
  db().prepare('UPDATE doors SET name=?, location=?, lock_type=?, device_id=?, relay_number=?, open_seconds=?, updated_at=? WHERE id=?')
    .run(d.name, d.location, d.lock_type, d.device_id, d.relay_number, d.open_seconds, nowLocal(), id);
  audit(req, 'update', 'door', id, { name: d.name, cambios: diff(before, d) });
  res.json(db().prepare(`${SELECT} WHERE d.id = ?`).get(id));
}));

r.delete('/:id', ah(async (req, res) => {
  const id = Number(req.params.id);
  const d = db().prepare('SELECT * FROM doors WHERE id = ?').get(id);
  if (!d) throw notFound('Puerta no encontrada');
  db().prepare('DELETE FROM doors WHERE id = ?').run(id);
  audit(req, 'delete', 'door', id, { name: d.name });
  res.json({ ok: true });
}));

/** Apertura remota por administrador: paso 1 (token de 30 s) */
r.post('/:id/open-token', openLimiter, ah(async (req, res) => {
  if (req.user.role === 'readonly') throw forbidden();
  const out = createOpenToken({ type: 'user', user: req.user }, Number(req.params.id));
  res.json({ ...out, requirePin: getSetting('require_admin_pin', '1') === '1' });
}));

/** Apertura remota por administrador: paso 2 (token + PIN) */
r.post('/open', openLimiter, ah(async (req, res) => {
  if (req.user.role === 'readonly') throw forbidden();
  const { token, pin } = parse(z.object({ token: z.string().min(10).max(100), pin: z.string().max(6).optional() }), req.body);
  const out = await consumeOpenToken({ type: 'user', user: req.user, requirePin: getSetting('require_admin_pin', '1') === '1' }, token, pin);
  audit(req, 'open', 'door', out.event?.door_id, { puerta: out.event?.door_name });
  res.json(out);
}));

export default r;
