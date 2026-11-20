import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { evaluateAccess, recordAccess } from './access.js';
import { deviceManager } from './deviceManager.js';
import { decryptPin, safeEqual, randomToken } from '../utils/crypto.js';
import { HttpError } from '../utils/http.js';

export const TOKEN_TTL_MS = 30_000;

function getDoor(doorId) {
  const door = db().prepare('SELECT * FROM doors WHERE id = ?').get(doorId);
  if (!door) throw new HttpError(404, 'Puerta no encontrada');
  return door;
}

/**
 * Paso 1: valida permiso + horario y emite un token de apertura de un solo uso (30 s).
 * subject = { type: 'person', person } | { type: 'user', user }
 */
export function createOpenToken(subject, doorId) {
  const door = getDoor(doorId);
  if (subject.type === 'person') {
    const { granted, reason } = evaluateAccess(subject.person, door.id);
    if (!granted) {
      recordAccess({ person: subject.person, door, method: 'web', granted: false, reason });
      throw new HttpError(403, reason);
    }
    if (!subject.person.pin_enc) throw new HttpError(400, 'No tiene un PIN configurado. Solicítelo al administrador.');
  }
  const now = Date.now();
  db().prepare('DELETE FROM open_tokens WHERE expires_at < ?').run(now - 60_000);
  const token = randomToken();
  db().prepare('INSERT INTO open_tokens (token, subject_type, subject_id, door_id, expires_at) VALUES (?, ?, ?, ?, ?)')
    .run(token, subject.type, subject.type === 'person' ? subject.person.id : subject.user.id, door.id, now + TOKEN_TTL_MS);
  return { token, expiresIn: TOKEN_TTL_MS / 1000, door: { id: door.id, name: door.name } };
}

/**
 * Paso 2: consume el token (atómico, un solo uso), valida PIN, revalida permiso y abre.
 */
export async function consumeOpenToken(subject, token, pin) {
  const subjectId = subject.type === 'person' ? subject.person.id : subject.user.id;
  const row = db().prepare('SELECT * FROM open_tokens WHERE token = ? AND subject_type = ? AND subject_id = ?').get(token, subject.type, subjectId);
  if (!row) throw new HttpError(400, 'Token de apertura inválido');
  const used = db().prepare('UPDATE open_tokens SET used_at = ? WHERE token = ? AND used_at IS NULL AND expires_at > ?').run(Date.now(), token, Date.now());
  if (used.changes !== 1) throw new HttpError(400, row.used_at ? 'El token ya fue utilizado' : 'El token expiró. Intente nuevamente.');

  const door = getDoor(row.door_id);
  const personName = subject.type === 'user' ? `${subject.user.name} (admin)` : null;
  const person = subject.type === 'person' ? subject.person : null;
  const deny = (reason, status = 403) => {
    recordAccess({ person, personName, door, method: 'web', granted: false, reason });
    throw new HttpError(status, reason);
  };

  // Validación de PIN
  if (subject.type === 'person') {
    if (!safeEqual(decryptPin(person.pin_enc), String(pin || ''))) deny('PIN incorrecto', 401);
    const { granted, reason } = evaluateAccess(person, door.id);
    if (!granted) deny(reason);
  } else {
    const u = db().prepare('SELECT pin_hash FROM users WHERE id = ?').get(subject.user.id);
    if (subject.requirePin) {
      if (!u?.pin_hash) throw new HttpError(400, 'Debe configurar su PIN de 6 dígitos en Configuración → Mi cuenta');
      if (!bcrypt.compareSync(String(pin || ''), u.pin_hash)) deny('PIN incorrecto', 401);
    }
  }

  try {
    const result = await deviceManager.openDoor(door);
    const ev = recordAccess({ person, personName, door, method: 'web', granted: true, reason: 'Apertura remota desde la web' });
    return { ok: true, message: `Puerta "${door.name}" abierta`, result, event: ev };
  } catch (err) {
    recordAccess({ person, personName, door, method: 'web', granted: false, reason: err.message });
    throw new HttpError(err.status || 502, err.message);
  }
}
