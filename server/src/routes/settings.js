import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { ah, parse } from '../utils/http.js';
import { requireRole, ROLES } from '../middleware/auth.js';
import { audit } from '../services/audit.js';

const r = Router();
const PUBLIC_KEYS = ['company_name', 'require_admin_pin', 'sim_unknown_rate'];

r.get('/', (_req, res) => {
  const rows = db().prepare(`SELECT key, value FROM settings WHERE key IN (${PUBLIC_KEYS.map(() => '?').join(',')})`).all(...PUBLIC_KEYS);
  res.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
});

r.put('/', requireRole(ROLES.SUPER), ah(async (req, res) => {
  const d = parse(z.object({
    company_name: z.string().trim().min(1, 'Ingrese el nombre de la empresa').max(80).optional(),
    require_admin_pin: z.enum(['0', '1']).optional(),
  }), req.body);
  const up = db().prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  for (const [k, v] of Object.entries(d)) up.run(k, v);
  audit(req, 'update', 'settings', null, d);
  res.json({ ok: true });
}));

export default r;
