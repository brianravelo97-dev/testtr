import { Router } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { z } from 'zod';
import { db } from '../db.js';
import { config } from '../config.js';
import { ah, parse, HttpError, notFound, paging } from '../utils/http.js';
import { isValidRut, normalizeRut } from '../utils/rut.js';
import { encryptPin } from '../utils/crypto.js';
import { audit, diff } from '../services/audit.js';
import { nowLocal } from '../utils/time.js';

const r = Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: config.uploadsDir,
    filename: (_req, file, cb) => {
      const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[file.mimetype] || '.img';
      cb(null, `p-${crypto.randomBytes(12).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new HttpError(400, 'Formato de imagen no permitido (use JPG, PNG o WebP)'));
  },
});

const optStr = (max) => z.string().trim().max(max).nullable().optional().transform((v) => (v ? v : null));
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD)').or(z.literal('')).nullable().optional().transform((v) => v || null);

const schema = z.object({
  name: z.string().trim().min(2, 'Ingrese el nombre').max(120),
  rut: z.string().trim().refine(isValidRut, 'RUT inválido').transform(normalizeRut),
  position: optStr(80),
  area: optStr(80),
  email: z.string().trim().email('Email inválido').max(120).or(z.literal('')).nullable().optional().transform((v) => v || null),
  phone: z.string().trim().regex(/^[0-9+\s()-]{0,20}$/, 'Teléfono inválido').nullable().optional().transform((v) => v || null),
  status: z.enum(['active', 'suspended']).default('active'),
  valid_from: dateStr,
  valid_to: dateStr,
  fingerprint_id: z.union([z.number().int().min(1).max(65534), z.literal(''), z.null()]).optional()
    .transform((v) => (v === '' || v == null ? null : v)),
  card_number: z.string().trim().regex(/^\d{0,20}$/, 'El número de tarjeta debe ser numérico').nullable().optional().transform((v) => v || null),
  pin: z.string().regex(/^\d{6}$/, 'El PIN debe tener 6 dígitos').or(z.literal('')).optional(),
  clear_pin: z.boolean().optional(),
  web_access: z.boolean().default(false),
  web_password: z.string().min(8, 'La contraseña web debe tener al menos 8 caracteres').max(128).or(z.literal('')).optional(),
  group_ids: z.array(z.number().int()).max(100).optional(),
}).refine((d) => !d.valid_from || !d.valid_to || d.valid_from <= d.valid_to, { message: 'La fecha de término debe ser posterior al inicio', path: ['valid_to'] });

/** Quita campos sensibles */
export function publicPerson(p) {
  if (!p) return p;
  const { pin_enc, web_password_hash, ...rest } = p;
  return { ...rest, web_access: !!p.web_access, has_pin: !!pin_enc, has_web_password: !!web_password_hash };
}

function withGroups(p) {
  const groups = db().prepare('SELECT g.id, g.name, g.color FROM access_groups g JOIN group_people gp ON gp.group_id = g.id WHERE gp.person_id = ? ORDER BY g.name').all(p.id);
  return { ...publicPerson(p), groups };
}

function checkUnique(d, id = 0) {
  const q = (col, val) => db().prepare(`SELECT name FROM people WHERE ${col} = ? AND id <> ?`).get(val, id);
  let dup = q('rut', d.rut);
  if (dup) throw new HttpError(409, `El RUT ya está registrado (${dup.name})`);
  if (d.fingerprint_id != null && (dup = q('fingerprint_id', d.fingerprint_id))) throw new HttpError(409, `El ID de huella ${d.fingerprint_id} ya está asignado a ${dup.name}`);
  if (d.card_number && (dup = q('card_number', d.card_number))) throw new HttpError(409, `La tarjeta ya está asignada a ${dup.name}`);
}

function setGroups(personId, groupIds) {
  if (!groupIds) return;
  db().prepare('DELETE FROM group_people WHERE person_id = ?').run(personId);
  const ins = db().prepare('INSERT OR IGNORE INTO group_people (group_id, person_id) SELECT id, ? FROM access_groups WHERE id = ?');
  for (const g of groupIds) ins.run(personId, g);
}

const SORTS = { name: 'p.name', rut: 'p.rut', area: 'p.area', status: 'p.status', created_at: 'p.created_at', valid_to: 'p.valid_to' };

r.get('/', (req, res) => {
  const { page, pageSize, offset } = paging(req.query, 200);
  const where = [];
  const params = {};
  if (req.query.q) {
    where.push('(p.name LIKE @q OR p.rut LIKE @q OR p.email LIKE @q OR p.card_number LIKE @q OR p.position LIKE @q)');
    params.q = `%${String(req.query.q).replace(/\./g, '')}%`;
  }
  if (['active', 'suspended'].includes(req.query.status)) { where.push('p.status = @status'); params.status = req.query.status; }
  if (req.query.area) { where.push('p.area = @area'); params.area = String(req.query.area); }
  if (req.query.group_id) { where.push('EXISTS (SELECT 1 FROM group_people gp WHERE gp.person_id = p.id AND gp.group_id = @gid)'); params.gid = Number(req.query.group_id); }
  if (req.query.vigencia === 'expired') where.push("p.valid_to IS NOT NULL AND p.valid_to < date('now','localtime')");
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sort = SORTS[req.query.sort] || 'p.name';
  const dir = req.query.dir === 'desc' ? 'DESC' : 'ASC';
  const total = db().prepare(`SELECT COUNT(*) c FROM people p ${w}`).get(params).c;
  const rows = db().prepare(`SELECT p.* FROM people p ${w} ORDER BY ${sort} ${dir} LIMIT @limit OFFSET @offset`).all({ ...params, limit: pageSize, offset });
  res.json({ data: rows.map(withGroups), total, page, pageSize });
});

r.get('/areas', (_req, res) => {
  res.json(db().prepare("SELECT DISTINCT area FROM people WHERE area IS NOT NULL AND area <> '' ORDER BY area").all().map((r) => r.area));
});

/** Lista breve para selectores */
r.get('/options', (_req, res) => {
  res.json(db().prepare('SELECT id, name, rut FROM people ORDER BY name').all());
});

r.get('/:id', (req, res) => {
  const p = db().prepare('SELECT * FROM people WHERE id = ?').get(Number(req.params.id));
  if (!p) throw notFound('Persona no encontrada');
  res.json(withGroups(p));
});

r.post('/', ah(async (req, res) => {
  const d = parse(schema, req.body);
  checkUnique(d);
  if (d.web_access && !d.web_password) throw new HttpError(400, 'Defina una contraseña web para habilitar el acceso web');
  const now = nowLocal();
  const tx = db().transaction(() => {
    const info = db().prepare(`INSERT INTO people (name, rut, position, area, email, phone, status, valid_from, valid_to, fingerprint_id, card_number, pin_enc, web_access, web_password_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      d.name, d.rut, d.position, d.area, d.email, d.phone, d.status, d.valid_from, d.valid_to, d.fingerprint_id, d.card_number,
      d.pin ? encryptPin(d.pin) : null, d.web_access ? 1 : 0, d.web_password ? bcrypt.hashSync(d.web_password, 10) : null, now, now);
    setGroups(info.lastInsertRowid, d.group_ids);
    return info.lastInsertRowid;
  });
  const id = tx();
  const { pin, web_password, ...logData } = d;
  audit(req, 'create', 'person', id, { ...logData, pin: pin ? 'x' : undefined });
  res.status(201).json(withGroups(db().prepare('SELECT * FROM people WHERE id = ?').get(id)));
}));

r.put('/:id', ah(async (req, res) => {
  const id = Number(req.params.id);
  const before = db().prepare('SELECT * FROM people WHERE id = ?').get(id);
  if (!before) throw notFound('Persona no encontrada');
  const d = parse(schema, req.body);
  checkUnique(d, id);
  if (d.web_access && !d.web_password && !before.web_password_hash) throw new HttpError(400, 'Defina una contraseña web para habilitar el acceso web');
  const pinEnc = d.clear_pin ? null : d.pin ? encryptPin(d.pin) : before.pin_enc;
  const webHash = d.web_password ? bcrypt.hashSync(d.web_password, 10) : before.web_password_hash;
  const beforeGroups = db().prepare('SELECT group_id FROM group_people WHERE person_id = ?').all(id).map((g) => g.group_id).sort().join(',');
  db().transaction(() => {
    db().prepare(`UPDATE people SET name=?, rut=?, position=?, area=?, email=?, phone=?, status=?, valid_from=?, valid_to=?, fingerprint_id=?, card_number=?, pin_enc=?, web_access=?, web_password_hash=?, updated_at=? WHERE id=?`)
      .run(d.name, d.rut, d.position, d.area, d.email, d.phone, d.status, d.valid_from, d.valid_to, d.fingerprint_id, d.card_number, pinEnc, d.web_access ? 1 : 0, webHash, nowLocal(), id);
    setGroups(id, d.group_ids);
  })();
  const changes = diff(before, {
    name: d.name, rut: d.rut, position: d.position, area: d.area, email: d.email, phone: d.phone, status: d.status,
    valid_from: d.valid_from, valid_to: d.valid_to, fingerprint_id: d.fingerprint_id, card_number: d.card_number, web_access: d.web_access ? 1 : 0,
  });
  if (d.pin || d.clear_pin) changes.pin = { de: '••••', a: d.clear_pin ? 'eliminado' : '••••' };
  if (d.web_password) changes.web_password = { de: '••••', a: '••••' };
  if (d.group_ids && d.group_ids.slice().sort().join(',') !== beforeGroups) changes.grupos = { de: beforeGroups, a: d.group_ids.join(',') };
  audit(req, 'update', 'person', id, { name: d.name, cambios: changes });
  res.json(withGroups(db().prepare('SELECT * FROM people WHERE id = ?').get(id)));
}));

r.delete('/:id', ah(async (req, res) => {
  const id = Number(req.params.id);
  const p = db().prepare('SELECT * FROM people WHERE id = ?').get(id);
  if (!p) throw notFound('Persona no encontrada');
  db().prepare('DELETE FROM people WHERE id = ?').run(id);
  if (p.photo) fs.rm(path.join(config.uploadsDir, path.basename(p.photo)), { force: true }, () => {});
  audit(req, 'delete', 'person', id, { name: p.name, rut: p.rut });
  res.json({ ok: true });
}));

r.post('/:id/photo', upload.single('photo'), ah(async (req, res) => {
  const id = Number(req.params.id);
  const p = db().prepare('SELECT * FROM people WHERE id = ?').get(id);
  if (!p) { if (req.file) fs.rmSync(req.file.path, { force: true }); throw notFound('Persona no encontrada'); }
  if (!req.file) throw new HttpError(400, 'Adjunte una imagen');
  // verifica la firma del archivo (no confiar sólo en el mimetype)
  const head = fs.readFileSync(req.file.path).subarray(0, 12);
  const valid = (head[0] === 0xff && head[1] === 0xd8) || head.subarray(1, 4).toString() === 'PNG' || head.subarray(8, 12).toString() === 'WEBP';
  if (!valid) { fs.rmSync(req.file.path, { force: true }); throw new HttpError(400, 'El archivo no es una imagen válida'); }
  if (p.photo) fs.rm(path.join(config.uploadsDir, path.basename(p.photo)), { force: true }, () => {});
  const url = `/uploads/${req.file.filename}`;
  db().prepare('UPDATE people SET photo = ?, updated_at = ? WHERE id = ?').run(url, nowLocal(), id);
  audit(req, 'update', 'person', id, { name: p.name, cambios: { foto: { de: p.photo, a: url } } });
  res.json({ photo: url });
}));

r.delete('/:id/photo', ah(async (req, res) => {
  const id = Number(req.params.id);
  const p = db().prepare('SELECT * FROM people WHERE id = ?').get(id);
  if (!p) throw notFound('Persona no encontrada');
  if (p.photo) fs.rm(path.join(config.uploadsDir, path.basename(p.photo)), { force: true }, () => {});
  db().prepare('UPDATE people SET photo = NULL WHERE id = ?').run(id);
  audit(req, 'update', 'person', id, { name: p.name, cambios: { foto: 'eliminada' } });
  res.json({ ok: true });
}));

export default r;
