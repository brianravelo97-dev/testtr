import { db } from '../db.js';
import { createDriver } from '../drivers/index.js';
import { bus } from './events.js';
import { processDeviceRead, recordAccess, identifyPerson, evaluateAccess } from './access.js';
import { nowLocal, toLocal } from '../utils/time.js';
import { decryptPin } from '../utils/crypto.js';
import { config } from '../config.js';

/** Gestiona instancias de drivers, monitoreo de estado y eventos de lectores */
class DeviceManager {
  constructor() {
    this.drivers = new Map(); // id → { driver, version }
    this.monitorTimer = null;
  }

  getDevice(id) {
    return db().prepare('SELECT * FROM devices WHERE id = ?').get(id);
  }

  /** Devuelve (o crea) el driver de un dispositivo; se recrea si el dispositivo cambió */
  driverFor(device) {
    const version = device.updated_at + device.driver + device.config + device.ip + device.port;
    const cached = this.drivers.get(device.id);
    if (cached && cached.version === version) return cached.driver;
    if (cached) { cached.driver.stop(); cached.driver.removeAllListeners(); }
    const driver = createDriver(device);
    driver.on('read', (read) => this.handleRead(device.id, read));
    this.drivers.set(device.id, { driver, version });
    if (this.monitorTimer) driver.start();
    return driver;
  }

  removeDevice(id) {
    const cached = this.drivers.get(id);
    if (cached) { cached.driver.stop(); cached.driver.removeAllListeners(); this.drivers.delete(id); }
  }

  /** Lectura recibida desde un lector: se asigna a la puerta asociada al número de relé */
  handleRead(deviceId, read) {
    const doors = db().prepare('SELECT * FROM doors WHERE device_id = ? ORDER BY relay_number').all(deviceId);
    if (doors.length === 0) return;
    // el simulador reparte las lecturas entre sus puertas; un equipo real usa el número de puerta reportado
    const door = this.getDevice(deviceId)?.driver === 'simulator'
      ? doors[Math.floor(Math.random() * doors.length)]
      : doors.find((d) => d.relay_number === (read.doorNumber || 1)) || doors[0];
    processDeviceRead({ deviceId, doorId: door.id, method: read.method, credential: read.credential, at: read.at || new Date() });
  }

  setStatus(device, status) {
    const now = nowLocal();
    if (status === 'online') {
      db().prepare('UPDATE devices SET status = ?, last_seen = ? WHERE id = ?').run(status, now, device.id);
    } else {
      db().prepare('UPDATE devices SET status = ? WHERE id = ?').run(status, device.id);
    }
    if (device.status !== status) bus.emit('device_status', { id: device.id, name: device.name, status, ts: now });
  }

  async testConnection(id) {
    const device = this.getDevice(id);
    if (!device) throw Object.assign(new Error('Dispositivo no encontrado'), { status: 404 });
    const driver = this.driverFor(device);
    const t0 = Date.now();
    try {
      const info = await driver.connect();
      this.setStatus(device, 'online');
      return { ok: true, latencyMs: Date.now() - t0, info };
    } catch (err) {
      this.setStatus(device, 'offline');
      return { ok: false, latencyMs: Date.now() - t0, error: err.message };
    }
  }

  /**
   * Sincroniza al dispositivo las personas activas con permiso en alguna de sus puertas.
   * Agrega/actualiza las que faltan y elimina del equipo las que ya no corresponden.
   */
  async syncUsers(id) {
    const device = this.getDevice(id);
    if (!device) throw Object.assign(new Error('Dispositivo no encontrado'), { status: 404 });
    const driver = this.driverFor(device);
    if (!driver.capabilities.users) throw Object.assign(new Error('Este tipo de dispositivo no administra usuarios'), { status: 400 });

    const people = db().prepare(`
      SELECT DISTINCT p.* FROM people p
      JOIN group_people gp ON gp.person_id = p.id
      JOIN group_doors gd ON gd.group_id = gp.group_id
      JOIN doors d ON d.id = gd.door_id
      WHERE d.device_id = ? AND p.status = 'active' AND p.fingerprint_id IS NOT NULL
        AND (p.valid_to IS NULL OR p.valid_to >= date('now','localtime'))`).all(id);

    try {
      const current = await driver.getUsers();
      const wanted = new Map(people.map((p) => [String(p.fingerprint_id), p]));
      let added = 0, updated = 0, removed = 0;
      for (const p of people) {
        const userId = String(p.fingerprint_id);
        const exists = current.find((u) => u.userId === userId);
        await driver.addUser({ userId, name: p.name, cardNumber: p.card_number || null, pin: decryptPin(p.pin_enc) });
        exists ? updated++ : added++;
      }
      for (const u of current) {
        if (!wanted.has(u.userId)) { await driver.deleteUser(u.userId); removed++; }
      }
      db().prepare('UPDATE devices SET last_sync = ? WHERE id = ?').run(nowLocal(), id);
      this.setStatus(device, 'online');
      return { ok: true, total: people.length, added, updated, removed };
    } catch (err) {
      this.setStatus(device, 'offline');
      throw Object.assign(new Error(`Error al sincronizar: ${err.message}`), { status: 502 });
    }
  }

  /** Descarga marcaciones del equipo y las registra como eventos (evita duplicados por fecha+usuario) */
  async importLogs(id) {
    const device = this.getDevice(id);
    if (!device) throw Object.assign(new Error('Dispositivo no encontrado'), { status: 404 });
    const driver = this.driverFor(device);
    if (!driver.capabilities.logs) throw Object.assign(new Error('Este dispositivo no almacena marcaciones'), { status: 400 });
    const logs = await driver.getAttendanceLogs();
    const door = db().prepare('SELECT * FROM doors WHERE device_id = ? ORDER BY relay_number LIMIT 1').get(id);
    if (!door) throw Object.assign(new Error('Asocie primero una puerta a este dispositivo'), { status: 400 });
    // evita duplicados: misma marca de tiempo en el mismo equipo
    const exists = db().prepare('SELECT 1 FROM access_logs WHERE device_id = ? AND ts = ?');
    let imported = 0;
    for (const log of logs) {
      if (!log.userId) continue;
      const ts = new Date(log.timestamp);
      if (exists.get(id, toLocal(ts))) continue;
      // el userId del equipo corresponde al "ID de huella" de la persona
      const person = identifyPerson('fingerprint', log.userId);
      const { granted, reason } = evaluateAccess(person, door.id, ts);
      recordAccess({ at: ts, person, door, deviceId: id, method: log.method || 'fingerprint', granted, reason, credential: log.userId, silent: true });
      imported++;
    }
    return { ok: true, total: logs.length, imported };
  }

  /** Abre una puerta mediante el driver de su dispositivo */
  async openDoor(door) {
    if (!door.device_id) throw Object.assign(new Error('La puerta no tiene un dispositivo asociado'), { status: 400 });
    const device = this.getDevice(door.device_id);
    if (!device) throw Object.assign(new Error('Dispositivo no encontrado'), { status: 404 });
    const driver = this.driverFor(device);
    try {
      const r = await driver.openDoor(door.relay_number || 1, door.open_seconds || 3);
      this.setStatus(device, 'online');
      return r;
    } catch (err) {
      this.setStatus(device, 'offline');
      throw Object.assign(new Error(`No se pudo abrir: ${err.message}`), { status: 502 });
    }
  }

  async checkAll() {
    const devices = db().prepare('SELECT * FROM devices').all();
    await Promise.all(devices.map((d) => this.testConnection(d.id).catch(() => null)));
  }

  /** Inicia monitoreo periódico y los procesos de cada driver (simulación / tiempo real) */
  async start() {
    this.monitorTimer = setInterval(() => this.checkAll(), Math.max(5, config.deviceCheckInterval) * 1000);
    const devices = db().prepare('SELECT * FROM devices').all();
    for (const d of devices) {
      const driver = this.driverFor(d);
      if (d.driver === 'simulator') await this.syncUsers(d.id).catch(() => null);
      driver.start();
    }
    this.checkAll();
  }

  /** Detiene todo (por ejemplo antes de restaurar un respaldo) */
  stopAll() {
    for (const { driver } of this.drivers.values()) { driver.stop(); driver.removeAllListeners(); }
    this.drivers.clear();
    if (this.monitorTimer) clearInterval(this.monitorTimer);
    this.monitorTimer = null;
  }
}

export const deviceManager = new DeviceManager();
export { recordAccess };
