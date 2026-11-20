import { Router } from 'express';
import { db } from '../db.js';
import { ah, paging } from '../utils/http.js';
import { METHOD_LABELS } from '../services/access.js';
import { toExcel, toPdf } from '../services/exporter.js';
import { formatTs } from '../services/format.js';
import { audit } from '../services/audit.js';

const r = Router();
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

function buildFilters(q) {
  const where = [];
  const p = {};
  if (isDate(q.from)) { where.push('l.ts >= @from'); p.from = `${q.from} 00:00:00`; }
  if (isDate(q.to)) { where.push('l.ts <= @to'); p.to = `${q.to} 23:59:59`; }
  if (q.person_id) { where.push('l.person_id = @person_id'); p.person_id = Number(q.person_id); }
  if (q.door_id) { where.push('l.door_id = @door_id'); p.door_id = Number(q.door_id); }
  if (METHOD_LABELS[q.method]) { where.push('l.method = @method'); p.method = q.method; }
  if (['granted', 'denied'].includes(q.result)) { where.push('l.result = @result'); p.result = q.result; }
  if (q.q) { where.push('(l.person_name LIKE @q OR l.reason LIKE @q OR l.credential LIKE @q)'); p.q = `%${q.q}%`; }
  return { w: where.length ? `WHERE ${where.join(' AND ')}` : '', p };
}

r.get('/', (req, res) => {
  const { page, pageSize, offset } = paging(req.query, 200);
  const { w, p } = buildFilters(req.query);
  const total = db().prepare(`SELECT COUNT(*) c FROM access_logs l ${w}`).get(p).c;
  const rows = db().prepare(`SELECT l.*, pe.photo, dv.name AS device_name FROM access_logs l
    LEFT JOIN people pe ON pe.id = l.person_id LEFT JOIN devices dv ON dv.id = l.device_id
    ${w} ORDER BY l.ts DESC, l.id DESC LIMIT @limit OFFSET @offset`).all({ ...p, limit: pageSize, offset });
  res.json({ data: rows, total, page, pageSize });
});

r.get('/export', ah(async (req, res) => {
  const { w, p } = buildFilters(req.query);
  const rows = db().prepare(`SELECT l.*, dv.name AS device_name FROM access_logs l LEFT JOIN devices dv ON dv.id = l.device_id ${w} ORDER BY l.ts DESC LIMIT 20000`).all(p);
  const columns = [
    { header: 'Fecha/Hora', key: 'ts', width: 20, format: (r) => formatTs(r.ts) },
    { header: 'Persona', key: 'person_name', width: 28, format: (r) => r.person_name || 'Desconocido' },
    { header: 'Puerta', key: 'door_name', width: 22 },
    { header: 'Dispositivo', key: 'device_name', width: 20 },
    { header: 'Método', key: 'method', width: 12, format: (r) => METHOD_LABELS[r.method] || r.method },
    { header: 'Credencial', key: 'credential', width: 16 },
    { header: 'Resultado', key: 'result', width: 12, format: (r) => (r.result === 'granted' ? 'Permitido' : 'Denegado') },
    { header: 'Motivo', key: 'reason', width: 34 },
  ];
  const range = [req.query.from && `desde ${formatTs(req.query.from)}`, req.query.to && `hasta ${formatTs(req.query.to)}`].filter(Boolean).join(' ');
  const opts = { title: 'Registro de accesos', subtitle: `${rows.length} registros ${range}`, sheet: 'Accesos', columns, rows, filename: `accesos_${new Date().toISOString().slice(0, 10)}` };
  audit(req, 'export', 'access_logs', null, { formato: req.query.format, registros: rows.length });
  if (req.query.format === 'pdf') {
    return toPdf(res, { ...opts, rowColor: (r, c) => (c.key === 'result' ? (r.result === 'granted' ? '#15803d' : '#b91c1c') : null) });
  }
  await toExcel(res, opts);
}));

export default r;
