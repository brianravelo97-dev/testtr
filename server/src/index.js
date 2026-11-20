import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { config } from './config.js';
import { db } from './db.js';
import { seed } from './seed.js';
import { bus } from './services/events.js';
import { deviceManager } from './services/deviceManager.js';
import { requireUser, writeGuard, verifyToken } from './middleware/auth.js';
import { apiLimiter } from './middleware/rateLimits.js';
import { HttpError } from './utils/http.js';

import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import peopleRoutes from './routes/people.js';
import groupsRoutes from './routes/groups.js';
import doorsRoutes from './routes/doors.js';
import devicesRoutes from './routes/devices.js';
import logsRoutes from './routes/logs.js';
import auditRoutes from './routes/audit.js';
import dashboardRoutes from './routes/dashboard.js';
import remoteRoutes from './routes/remote.js';
import backupRoutes from './routes/backup.js';
import settingsRoutes from './routes/settings.js';

db();
if (seed()) console.log('[seed] Base de datos nueva: datos de ejemplo cargados (admin / Admin123!)');

const app = express();
app.set('trust proxy', 'loopback');
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", 'ws:', 'wss:'],
      upgradeInsecureRequests: null,
    },
  },
  crossOriginEmbedderPolicy: false,
  strictTransportSecurity: false, // red local por HTTP
}));
if (config.corsOrigin) app.use(cors({ origin: config.corsOrigin.split(',').map((s) => s.trim()) }));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(config.uploadsDir, { maxAge: '7d', fallthrough: false }));

const api = express.Router();
api.use(apiLimiter);
api.get('/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));
api.use('/auth', authRoutes);
api.use('/remote', remoteRoutes);

// Rutas protegidas para administradores
api.use(requireUser, writeGuard);
api.use('/users', usersRoutes);
api.use('/people', peopleRoutes);
api.use('/groups', groupsRoutes);
api.use('/doors', doorsRoutes);
api.use('/devices', devicesRoutes);
api.use('/logs', logsRoutes);
api.use('/audit', auditRoutes);
api.use('/dashboard', dashboardRoutes);
api.use('/backup', backupRoutes);
api.use('/settings', settingsRoutes);
app.use('/api', api);
app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Ruta no encontrada')));

// Producción: sirve el frontend compilado
if (fs.existsSync(path.join(config.clientDist, 'index.html'))) {
  app.use(express.static(config.clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(config.clientDist, 'index.html')));
}

// Manejo de errores
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'El archivo supera el tamaño máximo permitido' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'Ya existe un registro con esos datos' });
  if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') return res.status(400).json({ error: 'Referencia inválida a otro registro' });
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 && !err.status ? 'Error interno del servidor' : err.message, details: err.details });
});

const server = http.createServer(app);

// WebSocket para eventos en tiempo real (/ws?token=JWT)
const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname !== '/ws') return socket.destroy();
  const payload = verifyToken(url.searchParams.get('token'));
  if (!payload || payload.typ !== 'user') {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    return socket.destroy();
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});
wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.send(JSON.stringify({ type: 'hello' }));
});
const broadcast = (type, data) => {
  const msg = JSON.stringify({ type, data });
  for (const c of wss.clients) if (c.readyState === 1) c.send(msg);
};
bus.on('access', (e) => broadcast('access', e));
bus.on('device_status', (e) => broadcast('device_status', e));
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30_000);

server.listen(config.port, '0.0.0.0', async () => {
  console.log(`[api] Servidor escuchando en http://localhost:${config.port}  (zona horaria: ${process.env.TZ || 'sistema'})`);
  await deviceManager.start();
});

const shutdown = () => { deviceManager.stopAll(); server.close(); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
