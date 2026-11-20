import { db } from '../db.js';
import { bus } from './events.js';
import { toLocal, dateOnly, hhmm } from '../utils/time.js';
import { decryptPin, safeEqual } from '../utils/crypto.js';

export const METHOD_LABELS = { fingerprint: 'Huella', card: 'Tarjeta', pin: 'PIN', web: 'Web' };

/** ¿El instante `at` cae dentro del horario? Soporta rangos que cruzan medianoche. */
export function scheduleMatches(schedule, at) {
  const days = String(schedule.days).split(',').filter(Boolean).map(Number);
  const day = at.getDay();
  const prev = (day + 6) % 7;
  const t = hhmm(at);
  const { start_time: s, end_time: e } = schedule;
  if (s <= e) return days.includes(day) && t >= s && t <= e;
  return (days.includes(day) && t >= s) || (days.includes(prev) && t < e);
}

/**
 * Evalúa si una persona puede pasar por una puerta en un instante dado.
 * Reglas: estado activo → vigencia → grupo con la puerta → horario del grupo.
 */
export function evaluateAccess(person, doorId, at = new Date()) {
  if (!person) return { granted: false, reason: 'Credencial no registrada' };
  if (person.status !== 'active') return { granted: false, reason: 'Persona suspendida' };
  const today = dateOnly(at);
  if (person.valid_from && today < person.valid_from) return { granted: false, reason: 'Acceso aún no vigente' };
  if (person.valid_to && today > person.valid_to) return { granted: false, reason: 'Vigencia de acceso vencida' };

  const groups = db().prepare(`
    SELECT g.id, g.name FROM access_groups g
    JOIN group_people gp ON gp.group_id = g.id
    JOIN group_doors gd ON gd.group_id = g.id
    WHERE gp.person_id = ? AND gd.door_id = ?`).all(person.id, doorId);
  if (groups.length === 0) return { granted: false, reason: 'Sin permiso para esta puerta' };

  const schedStmt = db().prepare('SELECT * FROM group_schedules WHERE group_id = ?');
  for (const g of groups) {
    for (const s of schedStmt.all(g.id)) {
      if (scheduleMatches(s, at)) return { granted: true, reason: `Acceso permitido (grupo ${g.name})`, group: g.name };
    }
  }
  return { granted: false, reason: 'Fuera de horario permitido' };
}

/** Puertas que una persona tiene asignadas mediante sus grupos */
export function doorsForPerson(personId) {
  return db().prepare(`
    SELECT DISTINCT d.id, d.name, d.location, d.lock_type, d.device_id
    FROM doors d
    JOIN group_doors gd ON gd.door_id = d.id
    JOIN group_people gp ON gp.group_id = gd.group_id
    WHERE gp.person_id = ? ORDER BY d.name`).all(personId);
}

/** Identifica a la persona a partir de una credencial leída por un dispositivo */
export function identifyPerson(method, credential) {
  if (credential == null || credential === '') return null;
  const cred = String(credential);
  if (method === 'fingerprint') {
    return db().prepare('SELECT * FROM people WHERE fingerprint_id = ?').get(Number(cred)) || null;
  }
  if (method === 'card') {
    return db().prepare('SELECT * FROM people WHERE card_number = ?').get(cred) || null;
  }
  if (method === 'pin') {
    const rows = db().prepare('SELECT * FROM people WHERE pin_enc IS NOT NULL').all();
    return rows.find((p) => safeEqual(decryptPin(p.pin_enc), cred)) || null;
  }
  return null;
}

/** Registra un evento de acceso y lo emite en tiempo real */
export function recordAccess({ at = new Date(), person = null, personName = null, door = null, deviceId = null, method, granted, reason, credential = null, silent = false }) {
  const ts = toLocal(at);
  const masked = credential == null ? null : method === 'pin' ? '••••••' : String(credential);
  const info = db().prepare(`INSERT INTO access_logs (ts, person_id, person_name, door_id, door_name, device_id, method, result, reason, credential)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    ts, person?.id ?? null, person?.name ?? personName ?? null, door?.id ?? null, door?.name ?? null,
    deviceId ?? door?.device_id ?? null, method, granted ? 'granted' : 'denied', reason, masked,
  );
  const event = {
    id: info.lastInsertRowid, ts, person_id: person?.id ?? null, person_name: person?.name ?? personName ?? null,
    door_id: door?.id ?? null, door_name: door?.name ?? null, method, result: granted ? 'granted' : 'denied', reason, credential: masked,
  };
  if (!silent) bus.emit('access', event);
  return event;
}

/**
 * Procesa una lectura proveniente de un dispositivo (huella, tarjeta o PIN):
 * identifica, evalúa y registra.
 */
export function processDeviceRead({ deviceId, doorId, method, credential, at = new Date() }) {
  const door = db().prepare('SELECT * FROM doors WHERE id = ?').get(doorId);
  if (!door) return null;
  const person = identifyPerson(method, credential);
  const { granted, reason } = evaluateAccess(person, door.id, at);
  return recordAccess({ at, person, door, deviceId, method, granted, reason, credential });
}
