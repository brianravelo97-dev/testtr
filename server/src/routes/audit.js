import { Router } from 'express';
import { db } from '../db.js';
import { ah, paging } from '../utils/http.js';
import { toExcel, toPdf } from '../services/exporter.js';
import { formatTs } from '../services/format.js';

const r = Router();
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

function filters(q) {
  const where = [];
  const p = {};
  if (isDate(q.from)) { where.push('ts >= @from'); p.from = `${q.from} 00:00:00`; }
  if (isDate(q.to)) { where.push('ts <= @to'); p.to = `${q.to} 23:59:59`; }
  if (q.user) { where.push('username = @user'); p.user = String(q.user); }
  if (q.action) { where.push('action = @action'); p.action = String(q.action); }
  if (q.entity) { where.push('entity = @entity'); p.entity = String(q.entity); }
  if (q.q) { where.push('(details LIKE @q OR entity_id = @qe)'); p.q = `%${q.q}%`; p.qe = String(q.q); }
  return { w: where.length ? `WHERE ${where.join(' AND ')}` : '', p };
}

r.get('/', (req, res) => {
  const { page, pageSize, offset } = paging(req.query, 200);
  const { w, p } = filters(req.query);
  const total = db().prepare(`SELECT COUNT(*) c FROM audit_logs ${w}`).get(p).c;
  const rows = db().prepare(`SELECT * FROM audit_logs ${w} ORDER BY ts DESC, id DESC LIMIT @limit OFFSET @offset`).all({ ...p, limit: pageSize, offset });
  res.json({ data: rows.map((r) => ({ ...r, details: r.details ? JSON.parse(r.details) : null })), total, page, pageSize });
});

r.get('/meta', (_req, res) => {
  res.json({
    users: db().prepare('SELECT DISTINCT username FROM audit_logs WHERE username IS NOT NULL ORDER BY username').all().map((r) => r.username),
    actions: db().prepare('SELECT DISTINCT action FROM audit_logs ORDER BY action').all().map((r) => r.action),
    entities: db().prepare('SELECT DISTINCT entity FROM audit_logs ORDER BY entity').all().map((r) => r.entity),
  });
});

r.get('/export', ah(async (req, res) => {
  const { w, p } = filters(req.query);
  const rows = db().prepare(`SELECT * FROM audit_logs ${w} ORDER BY ts DESC LIMIT 20000`).all(p);
  const columns = [
    { header: 'Fecha/Hora', key: 'ts', width: 20, format: (r) => formatTs(r.ts) },
    { header: 'Usuario', key: 'username', width: 16 },
    { header: 'Acción', key: 'action', width: 14 },
    { header: 'Entidad', key: 'entity', width: 14 },
    { header: 'ID', key: 'entity_id', width: 8 },
    { header: 'Detalle', key: 'details', width: 60 },
    { header: 'IP', key: 'ip', width: 16 },
  ];
  const opts = { title: 'Auditoría de administradores', subtitle: `${rows.length} registros`, sheet: 'Auditoría', columns, rows, filename: `auditoria_${new Date().toISOString().slice(0, 10)}` };
  if (req.query.format === 'pdf') return toPdf(res, opts);
  await toExcel(res, opts);
}));

export default r;
