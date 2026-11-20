import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { ah, parse, notFound } from '../utils/http.js';
import { audit, diff } from '../services/audit.js';
import { deviceManager } from '../services/deviceManager.js';
import { driverList, DRIVERS } from '../drivers/index.js';
import { nowLocal } from '../utils/time.js';

const r = Router();

const ipRegex = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$|^[a-zA-Z0-9.-]+$/;
const schema = z.object({
  name: z.string().trim().min(2, 'Ingrese el nombre').max(80),
  brand: z.string().trim().max(60).nullable().optional().transform((v) => v || null),
  model: z.string().trim().max(60).nullable().optional().transform((v) => v || null),
  ip: z.string().trim().max(100).regex(ipRegex, 'IP o nombre de host inválido').or(z.literal('')).nullable().optional().transform((v) => v || null),
  port: z.union([z.number().int().min(1).max(65535), z.literal(''), z.null()]).optional().transform((v) => (v === '' || v == null ? null : v)),
  driver: z.enum(Object.keys(DRIVERS), { message: 'Driver inválido' }),
  config: z.record(z.string(), z.any()).default({}),
}).refine((d) => d.driver === 'simulator' || d.ip, { message: 'La IP es obligatoria para dispositivos reales', path: ['ip'] });

const parseRow = (d) => (d ? { ...d, config: JSON.parse(d.config || '{}') } : d);
const SELECT = `SELECT dv.*, (SELECT COUNT(*) FROM doors WHERE device_id = dv.id) AS door_count,
  (SELECT group_concat(name, ', ') FROM doors WHERE device_id = dv.id) AS door_names FROM devices dv`;

r.get('/drivers', (_req, res) => res.json(driverList()));

r.get('/', (_req, res) => res.json(db().prepare(`${SELECT} ORDER BY dv.name`).all().map(parseRow)));

r.get('/:id', (req, res) => {
  const d = db().prepare(`${SELECT} WHERE dv.id = ?`).get(Number(req.params.id));
  if (!d) throw notFound('Dispositivo no encontrado');
  res.json(parseRow(d));
});

r.post('/', ah(async (req, res) => {
  const d = parse(schema, req.body);
  const info = db().prepare('INSERT INTO devices (name, brand, model, ip, port, driver, config, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(d.name, d.brand, d.model, d.ip, d.port, d.driver, JSON.stringify(d.config), nowLocal(), nowLocal());
  audit(req, 'create', 'device', info.lastInsertRowid, d);
  const id = Number(info.lastInsertRowid);
  deviceManager.testConnection(id).catch(() => null);
  res.status(201).json(parseRow(db().prepare(`${SELECT} WHERE dv.id = ?`).get(id)));
}));

r.put('/:id', ah(async (req, res) => {
  const id = Number(req.params.id);
  const before = db().prepare('SELECT * FROM devices WHERE id = ?').get(id);
  if (!before) throw notFound('Dispositivo no encontrado');
  const d = parse(schema, req.body);
  const cfg = JSON.stringify(d.config);
  db().prepare('UPDATE devices SET name=?, brand=?, model=?, ip=?, port=?, driver=?, config=?, updated_at=? WHERE id=?')
    .run(d.name, d.brand, d.model, d.ip, d.port, d.driver, cfg, nowLocal(), id);
  audit(req, 'update', 'device', id, { name: d.name, cambios: diff(before, { ...d, config: cfg }) });
  res.json(parseRow(db().prepare(`${SELECT} WHERE dv.id = ?`).get(id)));
}));

r.delete('/:id', ah(async (req, res) => {
  const id = Number(req.params.id);
  const d = db().prepare('SELECT * FROM devices WHERE id = ?').get(id);
  if (!d) throw notFound('Dispositivo no encontrado');
  deviceManager.removeDevice(id);
  db().prepare('DELETE FROM devices WHERE id = ?').run(id);
  audit(req, 'delete', 'device', id, { name: d.name });
  res.json({ ok: true });
}));

r.post('/:id/test', ah(async (req, res) => {
  const out = await deviceManager.testConnection(Number(req.params.id));
  audit(req, 'test', 'device', req.params.id, { resultado: out.ok ? 'online' : 'offline', error: out.error });
  res.json(out);
}));

r.post('/:id/sync', ah(async (req, res) => {
  const out = await deviceManager.syncUsers(Number(req.params.id));
  audit(req, 'sync', 'device', req.params.id, out);
  res.json(out);
}));

r.post('/:id/import-logs', ah(async (req, res) => {
  const out = await deviceManager.importLogs(Number(req.params.id));
  audit(req, 'import', 'device', req.params.id, out);
  res.json(out);
}));

/** Usuarios almacenados en el equipo (para comparar con el sistema) */
r.get('/:id/users', ah(async (req, res) => {
  const device = deviceManager.getDevice(Number(req.params.id));
  if (!device) throw notFound('Dispositivo no encontrado');
  const users = await deviceManager.driverFor(device).getUsers();
  res.json(users.map(({ pin, ...u }) => ({ ...u, has_pin: !!pin })));
}));

export default r;
