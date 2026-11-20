import { db } from '../db.js';
import { nowLocal } from '../utils/time.js';

const SENSITIVE = ['password', 'pin', 'web_password', 'password_hash', 'pin_hash', 'pin_enc', 'web_password_hash'];

function scrub(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE.includes(k)) { if (v) out[k] = '••••'; continue; }
    out[k] = v && typeof v === 'object' ? scrub(v) : v;
  }
  return out;
}

/** Registra una acción administrativa */
export function audit(req, action, entity, entityId = null, details = null) {
  const user = req?.user;
  db().prepare(`INSERT INTO audit_logs (ts, user_id, username, action, entity, entity_id, details, ip)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    nowLocal(),
    user?.id ?? null,
    user?.username ?? user?.name ?? null,
    action,
    entity,
    entityId == null ? null : String(entityId),
    details ? JSON.stringify(scrub(details)) : null,
    req?.ip ?? null,
  );
}

/** Calcula diferencias entre un registro anterior y uno nuevo */
export function diff(before, after) {
  const changes = {};
  for (const k of Object.keys(after)) {
    if (SENSITIVE.includes(k)) { if (after[k]) changes[k] = { de: '••••', a: '••••' }; continue; }
    if (before?.[k] !== after[k]) changes[k] = { de: before?.[k] ?? null, a: after[k] };
  }
  return changes;
}
