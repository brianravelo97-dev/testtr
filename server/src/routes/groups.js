import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { ah, parse, HttpError, notFound } from '../utils/http.js';
import { audit } from '../services/audit.js';
import { nowLocal } from '../utils/time.js';

const r = Router();
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (HH:MM)');

const schema = z.object({
  name: z.string().trim().min(2, 'Ingrese el nombre del grupo').max(60),
  description: z.string().trim().max(200).nullable().optional().transform((v) => v || null),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color inválido').default('#3b82f6'),
  schedules: z.array(z.object({
    days: z.array(z.number().int().min(0).max(6)).min(1, 'Seleccione al menos un día'),
    start_time: time,
    end_time: time,
  }).refine((s) => s.start_time !== s.end_time, { message: 'La hora de inicio y término no pueden ser iguales' })).max(20).default([]),
  person_ids: z.array(z.number().int()).max(5000).default([]),
  door_ids: z.array(z.number().int()).max(500).default([]),
});

function full(id) {
  const g = db().prepare('SELECT * FROM access_groups WHERE id = ?').get(id);
  if (!g) return null;
  g.schedules = db().prepare('SELECT id, days, start_time, end_time FROM group_schedules WHERE group_id = ? ORDER BY id').all(id)
    .map((s) => ({ ...s, days: s.days.split(',').filter(Boolean).map(Number) }));
  g.people = db().prepare('SELECT p.id, p.name, p.rut, p.status FROM people p JOIN group_people gp ON gp.person_id = p.id WHERE gp.group_id = ? ORDER BY p.name').all(id);
  g.doors = db().prepare('SELECT d.id, d.name FROM doors d JOIN group_doors gd ON gd.door_id = d.id WHERE gd.group_id = ? ORDER BY d.name').all(id);
  return g;
}

function save(id, d) {
  db().prepare('DELETE FROM group_schedules WHERE group_id = ?').run(id);
  db().prepare('DELETE FROM group_people WHERE group_id = ?').run(id);
  db().prepare('DELETE FROM group_doors WHERE group_id = ?').run(id);
  const insS = db().prepare('INSERT INTO group_schedules (group_id, days, start_time, end_time) VALUES (?, ?, ?, ?)');
  for (const s of d.schedules) insS.run(id, [...new Set(s.days)].sort().join(','), s.start_time, s.end_time);
  const insP = db().prepare('INSERT OR IGNORE INTO group_people (group_id, person_id) SELECT ?, id FROM people WHERE id = ?');
  for (const p of d.person_ids) insP.run(id, p);
  const insD = db().prepare('INSERT OR IGNORE INTO group_doors (group_id, door_id) SELECT ?, id FROM doors WHERE id = ?');
  for (const dr of d.door_ids) insD.run(id, dr);
}

r.get('/', (_req, res) => {
  const rows = db().prepare(`SELECT g.*,
      (SELECT COUNT(*) FROM group_people WHERE group_id = g.id) AS people_count,
      (SELECT COUNT(*) FROM group_doors WHERE group_id = g.id) AS door_count
    FROM access_groups g ORDER BY g.name`).all();
  res.json(rows.map((g) => ({ ...full(g.id), people_count: g.people_count, door_count: g.door_count })));
});

r.get('/:id', (req, res) => {
  const g = full(Number(req.params.id));
  if (!g) throw notFound('Grupo no encontrado');
  res.json(g);
});

r.post('/', ah(async (req, res) => {
  const d = parse(schema, req.body);
  if (db().prepare('SELECT 1 FROM access_groups WHERE name = ?').get(d.name)) throw new HttpError(409, 'Ya existe un grupo con ese nombre');
  const id = db().transaction(() => {
    const info = db().prepare('INSERT INTO access_groups (name, description, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(d.name, d.description, d.color, nowLocal(), nowLocal());
    save(info.lastInsertRowid, d);
    return info.lastInsertRowid;
  })();
  audit(req, 'create', 'group', id, d);
  res.status(201).json(full(id));
}));

r.put('/:id', ah(async (req, res) => {
  const id = Number(req.params.id);
  const before = full(id);
  if (!before) throw notFound('Grupo no encontrado');
  const d = parse(schema, req.body);
  if (db().prepare('SELECT 1 FROM access_groups WHERE name = ? AND id <> ?').get(d.name, id)) throw new HttpError(409, 'Ya existe un grupo con ese nombre');
  db().transaction(() => {
    db().prepare('UPDATE access_groups SET name = ?, description = ?, color = ?, updated_at = ? WHERE id = ?').run(d.name, d.description, d.color, nowLocal(), id);
    save(id, d);
  })();
  audit(req, 'update', 'group', id, {
    name: d.name,
    antes: { horarios: before.schedules.map((s) => `${s.days.join(',')} ${s.start_time}-${s.end_time}`), personas: before.people.length, puertas: before.doors.map((x) => x.name) },
    despues: { horarios: d.schedules.map((s) => `${s.days.join(',')} ${s.start_time}-${s.end_time}`), personas: d.person_ids.length, puertas: d.door_ids },
  });
  res.json(full(id));
}));

r.delete('/:id', ah(async (req, res) => {
  const id = Number(req.params.id);
  const g = db().prepare('SELECT * FROM access_groups WHERE id = ?').get(id);
  if (!g) throw notFound('Grupo no encontrado');
  db().prepare('DELETE FROM access_groups WHERE id = ?').run(id);
  audit(req, 'delete', 'group', id, { name: g.name });
  res.json({ ok: true });
}));

export default r;
