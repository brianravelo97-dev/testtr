import { DeviceDriver } from './DeviceDriver.js';

/**
 * Driver para lectores ZKTeco (K40, MB360, F18, SpeedFace, etc.) vía protocolo
 * propietario (TCP/UDP puerto 4370) usando la librería `node-zklib`.
 *
 * ESTADO: base funcional para conectar, leer usuarios y marcaciones y abrir la puerta.
 * Las operaciones de escritura (addUser/deleteUser/setCard) usan comandos crudos del
 * protocolo (CMD_USER_WRQ / CMD_DELETE_USER) y deben validarse con el modelo real,
 * ya que el formato del registro de usuario (28 vs 72 bytes) varía según el firmware.
 *
 * Config opcional (JSON en el dispositivo):
 *   { "timeout": 10000, "inport": 4000, "commKey": 0, "userRecordSize": 72 }
 */
const CMD = { USER_WRQ: 8, DELETE_USER: 18, UNLOCK: 31, REFRESHDATA: 1013 };

let ZKLibCtor = null;
async function loadLib() {
  if (ZKLibCtor) return ZKLibCtor;
  try {
    const mod = await import('node-zklib');
    ZKLibCtor = mod.default || mod;
    return ZKLibCtor;
  } catch {
    const e = new Error('La librería node-zklib no está instalada. Ejecute: npm install node-zklib -w server');
    e.status = 500;
    throw e;
  }
}

export class ZKTecoDriver extends DeviceDriver {
  static capabilities = { users: true, logs: true, open: true, realtime: true };

  constructor(device) {
    super(device);
    this.zk = null;
    this.uidMap = new Map(); // userId → uid interno del equipo
  }

  async #ensure() {
    if (this.zk) return this.zk;
    const ZKLib = await loadLib();
    const { ip, port } = this.device;
    if (!ip) throw new Error('El dispositivo no tiene IP configurada');
    this.zk = new ZKLib(ip, Number(port) || 4370, this.config.timeout || 10000, this.config.inport || 4000);
    try {
      await this.zk.createSocket();
    } catch (err) {
      this.zk = null;
      throw new Error(`No se pudo conectar con ${ip}:${port || 4370} (${err?.err?.message || err.message || err})`);
    }
    return this.zk;
  }

  async connect() {
    const zk = await this.#ensure();
    const info = await zk.getInfo().catch(() => ({}));
    return {
      model: this.device.model || 'ZKTeco',
      users: info.userCounts,
      logs: info.logCounts,
      capacity: info.logCapacity,
      connection: zk.connectionType,
    };
  }

  async disconnect() {
    if (this.zk) {
      try { await this.zk.disconnect(); } catch { /* ignore */ }
      this.zk = null;
    }
  }

  async getUsers() {
    const zk = await this.#ensure();
    const { data = [] } = await zk.getUsers();
    this.uidMap.clear();
    return data.map((u) => {
      this.uidMap.set(String(u.userId), u.uid);
      return { userId: String(u.userId), uid: u.uid, name: u.name, cardNumber: u.cardno ? String(u.cardno) : null, role: u.role };
    });
  }

  /** Construye el registro de usuario de 72 bytes (firmware TFT / ZK8) */
  #userRecord72({ uid, userId, name = '', pin = '', cardNumber = 0, role = 0 }) {
    const buf = Buffer.alloc(72);
    buf.writeUInt16LE(uid, 0);
    buf.writeUInt8(role, 2);
    buf.write(String(pin || '').slice(0, 8), 3, 8, 'ascii');
    buf.write(String(name).normalize('NFD').replace(/[̀-ͯ]/g, '').slice(0, 24), 11, 24, 'ascii');
    buf.writeUInt32LE(Number(cardNumber) >>> 0, 35);
    buf.write('1', 40, 7, 'ascii'); // grupo
    buf.write(String(userId).slice(0, 24), 48, 24, 'ascii');
    return buf;
  }

  async addUser(user) {
    const zk = await this.#ensure();
    if (this.uidMap.size === 0) await this.getUsers();
    const uid = this.uidMap.get(String(user.userId)) ?? Number(user.userId);
    await zk.executeCmd(CMD.USER_WRQ, this.#userRecord72({ ...user, uid }));
    await zk.executeCmd(CMD.REFRESHDATA, '');
    this.uidMap.set(String(user.userId), uid);
    return true;
  }

  async deleteUser(userId) {
    const zk = await this.#ensure();
    if (this.uidMap.size === 0) await this.getUsers();
    const uid = this.uidMap.get(String(userId)) ?? Number(userId);
    const buf = Buffer.alloc(2);
    buf.writeUInt16LE(uid, 0);
    await zk.executeCmd(CMD.DELETE_USER, buf);
    await zk.executeCmd(CMD.REFRESHDATA, '');
    this.uidMap.delete(String(userId));
    return true;
  }

  async setCard(userId, cardNumber) {
    const users = await this.getUsers();
    const u = users.find((x) => x.userId === String(userId));
    if (!u) throw new Error(`Usuario ${userId} no existe en el equipo`);
    return this.addUser({ ...u, cardNumber });
  }

  async openDoor(_doorNumber = 1, seconds = 3) {
    const zk = await this.#ensure();
    const buf = Buffer.alloc(4);
    buf.writeUInt32LE(Math.max(1, seconds) * 10, 0); // décimas de segundo
    await zk.executeCmd(CMD.UNLOCK, buf);
    return { opened: true, seconds };
  }

  async getAttendanceLogs() {
    const zk = await this.#ensure();
    const { data = [] } = await zk.getAttendances();
    return data.map((r) => ({ userId: String(r.deviceUserId), timestamp: new Date(r.recordTime), method: 'fingerprint' }));
  }

  /** Escucha marcaciones en tiempo real y las emite como evento 'read' */
  async start() {
    if (!this.config.realtime) return;
    try {
      const zk = await this.#ensure();
      await zk.getRealTimeLogs((log) => {
        this.emit('read', { method: 'fingerprint', credential: String(log.userId), at: new Date(), doorNumber: 1 });
      });
    } catch (err) {
      console.warn(`[zkteco] tiempo real no disponible en ${this.device.name}: ${err.message}`);
    }
  }

  stop() { this.disconnect(); }
}
