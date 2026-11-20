import Database from 'better-sqlite3';
import fs from 'node:fs';
import { config } from './config.js';

let instance = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  email TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin','admin','readonly')),
  pin_hash TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  last_login TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS people (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  rut TEXT NOT NULL UNIQUE,
  position TEXT,
  area TEXT,
  email TEXT,
  phone TEXT,
  photo TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  valid_from TEXT,
  valid_to TEXT,
  fingerprint_id INTEGER UNIQUE,
  card_number TEXT UNIQUE,
  pin_enc TEXT,
  web_access INTEGER NOT NULL DEFAULT 0,
  web_password_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_people_name ON people(name);

CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  ip TEXT,
  port INTEGER,
  driver TEXT NOT NULL DEFAULT 'simulator' CHECK (driver IN ('simulator','zkteco','relay')),
  config TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online','offline')),
  last_seen TEXT,
  last_sync TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS doors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  location TEXT,
  lock_type TEXT NOT NULL DEFAULT 'fail_secure' CHECK (lock_type IN ('fail_safe','fail_secure')),
  device_id INTEGER REFERENCES devices(id) ON DELETE SET NULL,
  relay_number INTEGER NOT NULL DEFAULT 1,
  open_seconds INTEGER NOT NULL DEFAULT 3,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS access_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS group_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL REFERENCES access_groups(id) ON DELETE CASCADE,
  days TEXT NOT NULL,          -- "1,2,3,4,5" (0=domingo ... 6=sábado)
  start_time TEXT NOT NULL,    -- "HH:MM"
  end_time TEXT NOT NULL       -- "HH:MM" (si es menor que inicio, cruza medianoche)
);

CREATE TABLE IF NOT EXISTS group_people (
  group_id INTEGER NOT NULL REFERENCES access_groups(id) ON DELETE CASCADE,
  person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, person_id)
);

CREATE TABLE IF NOT EXISTS group_doors (
  group_id INTEGER NOT NULL REFERENCES access_groups(id) ON DELETE CASCADE,
  door_id INTEGER NOT NULL REFERENCES doors(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, door_id)
);

CREATE TABLE IF NOT EXISTS access_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  person_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
  person_name TEXT,
  door_id INTEGER REFERENCES doors(id) ON DELETE SET NULL,
  door_name TEXT,
  device_id INTEGER REFERENCES devices(id) ON DELETE SET NULL,
  method TEXT NOT NULL CHECK (method IN ('fingerprint','card','pin','web')),
  result TEXT NOT NULL CHECK (result IN ('granted','denied')),
  reason TEXT,
  credential TEXT
);
CREATE INDEX IF NOT EXISTS idx_access_ts ON access_logs(ts);
CREATE INDEX IF NOT EXISTS idx_access_person ON access_logs(person_id);
CREATE INDEX IF NOT EXISTS idx_access_door ON access_logs(door_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  user_id INTEGER,
  username TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  details TEXT,
  ip TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_logs(ts);

CREATE TABLE IF NOT EXISTS open_tokens (
  token TEXT PRIMARY KEY,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('user','person')),
  subject_id INTEGER NOT NULL,
  door_id INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
`;

function open() {
  const d = new Database(config.dbPath);
  d.pragma('journal_mode = WAL');
  d.pragma('foreign_keys = ON');
  d.pragma('busy_timeout = 5000');
  d.exec(SCHEMA);
  const defaults = {
    company_name: 'Mi Empresa',
    require_admin_pin: '1',
    sim_unknown_rate: '0.1',
  };
  const ins = d.prepare('INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(defaults)) ins.run(k, v);
  return d;
}

/** Devuelve la conexión activa a SQLite */
export function db() {
  if (!instance) instance = open();
  return instance;
}

export function closeDb() {
  if (instance) {
    try { instance.close(); } catch { /* ignore */ }
    instance = null;
  }
}

/** Reemplaza el archivo de base de datos por otro (restauración) */
export function replaceDbFile(srcPath) {
  closeDb();
  for (const suffix of ['-wal', '-shm']) {
    const f = config.dbPath + suffix;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
  fs.copyFileSync(srcPath, config.dbPath);
  return db();
}

export function getSetting(key, fallback = null) {
  const row = db().prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}
