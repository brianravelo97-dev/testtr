import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(__dirname, '..');
export const PROJECT_ROOT = path.resolve(SERVER_ROOT, '..');
const envPath = path.join(PROJECT_ROOT, '.env');

// Crea .env automáticamente con secretos aleatorios si no existe
if (!fs.existsSync(envPath)) {
  const examplePath = path.join(PROJECT_ROOT, '.env.example');
  let content = fs.existsSync(examplePath) ? fs.readFileSync(examplePath, 'utf8') : '';
  content = content
    .replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${crypto.randomBytes(48).toString('hex')}`)
    .replace(/^PIN_ENC_KEY=.*$/m, `PIN_ENC_KEY=${crypto.randomBytes(32).toString('hex')}`);
  fs.writeFileSync(envPath, content);
  console.log('[config] Archivo .env creado con claves aleatorias');
}
dotenv.config({ path: envPath });

if (process.env.TZ) process.env.TZ = process.env.TZ; // aplica zona horaria

const pinKeyHex = process.env.PIN_ENC_KEY && /^[0-9a-f]{64}$/i.test(process.env.PIN_ENC_KEY)
  ? process.env.PIN_ENC_KEY
  : crypto.createHash('sha256').update(process.env.JWT_SECRET || 'dev').digest('hex');

export const config = {
  port: Number(process.env.PORT || 3001),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpires: process.env.JWT_EXPIRES || '8h',
  pinKey: Buffer.from(pinKeyHex, 'hex'),
  dbPath: path.resolve(SERVER_ROOT, process.env.DB_PATH || './data/control-acceso.db'),
  dataDir: path.join(SERVER_ROOT, 'data'),
  uploadsDir: path.join(SERVER_ROOT, 'data', 'uploads'),
  backupsDir: path.join(SERVER_ROOT, 'data', 'backups'),
  tmpDir: path.join(SERVER_ROOT, 'data', 'tmp'),
  simInterval: Number(process.env.SIM_EVENT_INTERVAL ?? 45),
  deviceCheckInterval: Number(process.env.DEVICE_CHECK_INTERVAL ?? 30),
  corsOrigin: process.env.CORS_ORIGIN || '',
  clientDist: path.join(PROJECT_ROOT, 'client', 'dist'),
};

for (const dir of [config.dataDir, config.uploadsDir, config.backupsDir, config.tmpDir]) {
  fs.mkdirSync(dir, { recursive: true });
}
