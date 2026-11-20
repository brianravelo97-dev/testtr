import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { db, replaceDbFile } from '../db.js';
import { config } from '../config.js';
import { ah, HttpError } from '../utils/http.js';
import { requireRole, ROLES } from '../middleware/auth.js';
import { audit } from '../services/audit.js';
import { deviceManager } from '../services/deviceManager.js';

const r = Router();
const upload = multer({ dest: config.tmpDir, limits: { fileSize: 500 * 1024 * 1024 } });
const stamp = () => new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
const REQUIRED_TABLES = ['users', 'people', 'doors', 'devices', 'access_groups', 'access_logs', 'audit_logs'];

/** Descarga un respaldo consistente (API de backup en línea de SQLite) */
r.get('/download', requireRole(ROLES.SUPER, ROLES.ADMIN), ah(async (req, res) => {
  const file = path.join(config.backupsDir, `respaldo_${stamp()}.db`);
  await db().backup(file);
  audit(req, 'backup', 'database', null, { archivo: path.basename(file) });
  res.download(file, path.basename(file));
}));

/** Restaura la base de datos desde un archivo .db (sólo Super Admin) */
r.post('/restore', requireRole(ROLES.SUPER), upload.single('file'), ah(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Adjunte el archivo de respaldo (.db)');
  const tmp = req.file.path;
  try {
    const header = Buffer.alloc(16);
    const fd = fs.openSync(tmp, 'r');
    fs.readSync(fd, header, 0, 16, 0);
    fs.closeSync(fd);
    if (header.toString('utf8', 0, 15) !== 'SQLite format 3') throw new HttpError(400, 'El archivo no es una base de datos SQLite válida');
    const test = new Database(tmp, { readonly: true });
    try {
      const tables = test.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((t) => t.name);
      const missing = REQUIRED_TABLES.filter((t) => !tables.includes(t));
      if (missing.length) throw new HttpError(400, `El respaldo no corresponde a este sistema (faltan tablas: ${missing.join(', ')})`);
      if (test.pragma('integrity_check', { simple: true }) !== 'ok') throw new HttpError(400, 'El respaldo está dañado (integrity_check falló)');
      if (!test.prepare("SELECT COUNT(*) c FROM users WHERE role = 'super_admin' AND active = 1").get().c) throw new HttpError(400, 'El respaldo no tiene ningún Super Admin activo');
    } finally {
      test.close();
    }
    // respaldo de seguridad antes de reemplazar
    const safety = path.join(config.backupsDir, `antes_de_restaurar_${stamp()}.db`);
    await db().backup(safety);
    const actor = { ...req, user: req.user };
    deviceManager.stopAll();
    replaceDbFile(tmp);
    await deviceManager.start();
    audit(actor, 'restore', 'database', null, { archivo: req.file.originalname, respaldo_previo: path.basename(safety) });
    res.json({ ok: true, message: 'Base de datos restaurada correctamente. Vuelva a iniciar sesión.', safety: path.basename(safety) });
  } finally {
    fs.rm(tmp, { force: true }, () => {});
  }
}));

r.get('/list', requireRole(ROLES.SUPER, ROLES.ADMIN), (_req, res) => {
  const files = fs.readdirSync(config.backupsDir).filter((f) => f.endsWith('.db')).map((f) => {
    const st = fs.statSync(path.join(config.backupsDir, f));
    return { name: f, size: st.size, date: st.mtime };
  }).sort((a, b) => b.date - a.date);
  res.json(files);
});

export default r;
