import fs from 'node:fs';
import bcrypt from 'bcryptjs';
import { pathToFileURL } from 'node:url';
import { config } from './config.js';
import { db, closeDb } from './db.js';
import { computeDv } from './utils/rut.js';
import { encryptPin } from './utils/crypto.js';
import { evaluateAccess, recordAccess } from './services/access.js';
import { nowLocal, dateOnly } from './utils/time.js';

const PEOPLE = [
  ['María José González Soto', 'Jefa de Administración', 'Administración', [1, 3], true],
  ['Carlos Andrés Muñoz Pérez', 'Supervisor de Bodega', 'Bodega', [2], true],
  ['Francisca Rojas Díaz', 'Gerente General', 'Gerencia', [3], true],
  ['Juan Pablo Contreras Silva', 'Contador', 'Administración', [1]],
  ['Camila Fernanda Sepúlveda', 'Asistente Administrativa', 'Administración', [1]],
  ['Diego Ignacio Morales', 'Operario de Bodega', 'Bodega', [2]],
  ['Valentina Araya Fuentes', 'Ejecutiva de RRHH', 'Recursos Humanos', [1]],
  ['Sebastián Torres Vargas', 'Bodeguero', 'Bodega', [2]],
  ['Javiera Espinoza Reyes', 'Analista TI', 'TI', [1, 2]],
  ['Matías Castillo Núñez', 'Grúa horquilla', 'Bodega', [2]],
  ['Constanza Herrera Lagos', 'Recepcionista', 'Administración', [1]],
  ['Felipe Alejandro Soto', 'Jefe de TI', 'TI', [3]],
  ['Rodrigo Vásquez Pinto', 'Contratista eléctrico', 'Externos', []],
  ['Antonia Bravo Cárdenas', 'Operaria de Bodega', 'Bodega', [2], false, 'suspended'],
  ['Ignacio Riquelme Salinas', 'Practicante', 'Administración', [1], false, 'active', true],
];

function rut(i) {
  const body = String(10_000_000 + ((i * 7_919_337) % 14_000_000));
  return `${body}-${computeDv(body)}`;
}

function randomDateInLastDays(days) {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * days));
  // la mayoría de los eventos ocurre en días hábiles
  if ((d.getDay() === 0 || d.getDay() === 6) && Math.random() < 0.7) {
    const back = d.getDay() === 0 ? 2 : 1;
    const limit = new Date(); limit.setDate(limit.getDate() - (days - 1)); limit.setHours(0, 0, 0, 0);
    const shifted = new Date(d); shifted.setDate(d.getDate() - back);
    if (shifted >= limit) d.setDate(d.getDate() - back);
    else d.setDate(d.getDate() + (d.getDay() === 0 ? 1 : 2));
  }
  // distribución con peaks en entrada (8-9), almuerzo (13-14) y salida (17-18)
  const peaks = [8, 8, 8, 9, 9, 13, 14, 14, 17, 18, 10, 11, 12, 15, 16, 17, 7, 19, 21];
  d.setHours(peaks[Math.floor(Math.random() * peaks.length)], Math.floor(Math.random() * 60), Math.floor(Math.random() * 60), 0);
  return d > new Date() ? new Date(Date.now() - Math.random() * 3_600_000) : d;
}

export function seed({ force = false } = {}) {
  if (force) {
    closeDb();
    for (const s of ['', '-wal', '-shm']) fs.rmSync(config.dbPath + s, { force: true });
  }
  const d = db();
  if (!force && d.prepare('SELECT COUNT(*) c FROM users').get().c > 0) return false;

  const now = nowLocal();
  const tx = d.transaction(() => {
    d.prepare(`INSERT INTO users (username, name, email, password_hash, role, pin_hash, created_at, updated_at) VALUES (?, ?, ?, ?, 'super_admin', ?, ?, ?)`)
      .run('admin', 'Administrador General', 'admin@empresa.cl', bcrypt.hashSync('Admin123!', 10), bcrypt.hashSync('123456', 10), now, now);

    const insDev = d.prepare('INSERT INTO devices (name, brand, model, ip, port, driver, config, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const dev1 = insDev.run('Huellero Recepción', 'ZKTeco', 'K40 (simulado)', '192.168.1.201', 4370, 'simulator', '{"unknownRate":0.1}', 'online', now, now).lastInsertRowid;
    const dev2 = insDev.run('Lector Bodega', 'ZKTeco', 'MB360 (simulado)', '192.168.1.202', 4370, 'simulator', '{"unknownRate":0.12}', 'online', now, now).lastInsertRowid;

    const insDoor = d.prepare('INSERT INTO doors (name, location, lock_type, device_id, relay_number, open_seconds, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const door1 = insDoor.run('Acceso Principal', 'Hall de entrada, piso 1', 'fail_secure', dev1, 1, 3, now, now).lastInsertRowid;
    const door2 = insDoor.run('Bodega', 'Galpón posterior', 'fail_secure', dev2, 1, 5, now, now).lastInsertRowid;
    const door3 = insDoor.run('Oficinas Administración', 'Piso 2, ala norte', 'fail_safe', dev1, 2, 3, now, now).lastInsertRowid;

    const insGroup = d.prepare('INSERT INTO access_groups (name, description, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?)');
    const insSched = d.prepare('INSERT INTO group_schedules (group_id, days, start_time, end_time) VALUES (?, ?, ?, ?)');
    const insGD = d.prepare('INSERT INTO group_doors (group_id, door_id) VALUES (?, ?)');
    const g1 = insGroup.run('Administración', 'Personal administrativo, horario de oficina', '#3b82f6', now, now).lastInsertRowid;
    insSched.run(g1, '1,2,3,4,5', '08:00', '19:00');
    insGD.run(g1, door1); insGD.run(g1, door3);
    const g2 = insGroup.run('Bodega', 'Operaciones de bodega, lunes a sábado', '#f59e0b', now, now).lastInsertRowid;
    insSched.run(g2, '1,2,3,4,5', '07:00', '18:00');
    insSched.run(g2, '6', '08:00', '13:00');
    insGD.run(g2, door1); insGD.run(g2, door2);
    const g3 = insGroup.run('Gerencia', 'Acceso total 24/7', '#8b5cf6', now, now).lastInsertRowid;
    insSched.run(g3, '0,1,2,3,4,5,6', '00:00', '23:59');
    insGD.run(g3, door1); insGD.run(g3, door2); insGD.run(g3, door3);
    const groupIds = [g1, g2, g3];

    const insP = d.prepare(`INSERT INTO people (name, rut, position, area, email, phone, status, valid_from, valid_to, fingerprint_id, card_number, pin_enc, web_access, web_password_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const insGP = d.prepare('INSERT INTO group_people (group_id, person_id) VALUES (?, ?)');
    const webHash = bcrypt.hashSync('Persona123!', 10);
    const start = new Date(); start.setMonth(start.getMonth() - 6);
    const expired = new Date(); expired.setDate(expired.getDate() - 20);
    PEOPLE.forEach(([name, position, area, groups, web = false, status = 'active', isExpired = false], i) => {
      const first = name.split(' ')[0].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      const last = name.split(' ').slice(-1)[0].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      const pid = insP.run(
        name, rut(i + 1), position, area, `${first}.${last}@empresa.cl`, `+56 9 ${String(50000000 + i * 1234567).slice(0, 8)}`,
        status, dateOnly(start), isExpired ? dateOnly(expired) : null, i + 1, String(1000450000 + i * 1371),
        web || i % 3 === 0 ? encryptPin(web ? '123456' : String(100000 + i * 11111).slice(0, 6)) : null,
        web ? 1 : 0, web ? webHash : null, now, now,
      ).lastInsertRowid;
      for (const g of groups) insGP.run(groupIds[g - 1], pid);
    });

    // 200 eventos de los últimos 7 días, evaluados con el motor de reglas real
    const people = d.prepare('SELECT * FROM people').all();
    const doorsById = Object.fromEntries(d.prepare('SELECT * FROM doors').all().map((x) => [x.id, x]));
    const doorsOf = (pid) => d.prepare('SELECT DISTINCT gd.door_id FROM group_doors gd JOIN group_people gp ON gp.group_id = gd.group_id WHERE gp.person_id = ?').all(pid).map((r) => r.door_id);
    const events = [];
    for (let k = 0; k < 200; k++) {
      const at = randomDateInLastDays(7);
      const roll = Math.random();
      if (roll < 0.06) {
        const door = doorsById[[door1, door2, door3][Math.floor(Math.random() * 3)]];
        events.push({ at, person: null, door, method: 'card', granted: false, reason: 'Credencial no registrada', credential: String(9000000000 + Math.floor(Math.random() * 1e8)) });
        continue;
      }
      const person = people[Math.floor(Math.random() * people.length)];
      const own = doorsOf(person.id);
      const doorId = own.length && Math.random() < 0.92 ? own[Math.floor(Math.random() * own.length)] : [door1, door2, door3][Math.floor(Math.random() * 3)];
      const door = doorsById[doorId];
      const methods = ['fingerprint', 'fingerprint', 'fingerprint', 'card', 'card'];
      if (person.pin_enc) methods.push('pin');
      if (person.web_access) methods.push('web');
      const method = methods[Math.floor(Math.random() * methods.length)];
      const credential = method === 'fingerprint' ? String(person.fingerprint_id) : method === 'card' ? person.card_number : method === 'pin' ? '000000' : null;
      const ev = evaluateAccess(person, door.id, at);
      events.push({ at, person, door, method, granted: ev.granted, reason: method === 'web' && ev.granted ? 'Apertura remota desde la web' : ev.reason, credential });
    }
    events.sort((a, b) => a.at - b.at).forEach((e) => recordAccess({ ...e, silent: true }));

    d.prepare(`INSERT INTO audit_logs (ts, username, action, entity, details) VALUES (?, 'sistema', 'seed', 'database', ?)`)
      .run(now, JSON.stringify({ mensaje: 'Datos de ejemplo cargados', personas: PEOPLE.length, eventos: 200 }));
  });
  tx();
  return true;
}

// Ejecución directa: node src/seed.js --force
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const force = process.argv.includes('--force');
  const done = seed({ force });
  console.log(done ? '✔ Datos de ejemplo cargados (usuario: admin / Admin123!)' : 'La base ya tiene datos. Use --force para reiniciarla.');
  closeDb();
}
