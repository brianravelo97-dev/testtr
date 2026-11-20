import { DeviceDriver } from './DeviceDriver.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * Simula un huellero/lector de tarjetas en memoria.
 * - Responde a todos los comandos con una pequeña latencia.
 * - Genera lecturas aleatorias (huella, tarjeta, PIN) cada `interval` segundos.
 * - Config opcional: { offline: true } para simular un equipo desconectado,
 *   { unknownRate: 0.1 } probabilidad de lectura de credencial desconocida.
 */
export class SimulatorDriver extends DeviceDriver {
  static capabilities = { users: true, logs: true, open: true, realtime: true };
  static stores = new Map(); // estado en memoria por dispositivo (sobrevive a recreación del driver)

  constructor(device, { interval = 45 } = {}) {
    super(device);
    this.interval = interval;
    if (!SimulatorDriver.stores.has(device.id)) {
      SimulatorDriver.stores.set(device.id, { users: new Map(), logs: [] });
    }
    this.store = SimulatorDriver.stores.get(device.id);
    this.timer = null;
  }

  async #latency() {
    await sleep(80 + Math.random() * 220);
    if (this.config.offline) {
      const e = new Error('Tiempo de espera agotado (simulador configurado como desconectado)');
      e.code = 'ETIMEDOUT';
      throw e;
    }
  }

  async connect() {
    await this.#latency();
    return {
      model: this.device.model || 'SIM-1000',
      serial: `SIM${String(this.device.id).padStart(6, '0')}`,
      firmware: 'Simulador v1.0',
      users: this.store.users.size,
      logs: this.store.logs.length,
    };
  }

  async getUsers() {
    await this.#latency();
    return [...this.store.users.values()];
  }

  async addUser(user) {
    await this.#latency();
    const prev = this.store.users.get(String(user.userId)) || {};
    this.store.users.set(String(user.userId), { ...prev, ...user, userId: String(user.userId) });
    return true;
  }

  async deleteUser(userId) {
    await this.#latency();
    return this.store.users.delete(String(userId));
  }

  async setCard(userId, cardNumber) {
    await this.#latency();
    const u = this.store.users.get(String(userId));
    if (!u) throw new Error(`Usuario ${userId} no existe en el dispositivo`);
    u.cardNumber = cardNumber;
    return true;
  }

  async openDoor(doorNumber = 1, seconds = 3) {
    await this.#latency();
    return { opened: true, doorNumber, seconds, message: `Relé ${doorNumber} activado por ${seconds}s (simulado)` };
  }

  async getAttendanceLogs() {
    await this.#latency();
    return [...this.store.logs];
  }

  /** Genera una lectura aleatoria como si alguien usara el lector */
  generateRead() {
    if (this.config.offline) return;
    const users = [...this.store.users.values()];
    const unknownRate = Number(this.config.unknownRate ?? 0.1);
    let read;
    if (users.length === 0 || Math.random() < unknownRate) {
      const method = rand(['card', 'fingerprint', 'card']);
      read = { method, credential: method === 'card' ? String(9000000000 + Math.floor(Math.random() * 99999999)) : String(900 + Math.floor(Math.random() * 99)) };
    } else {
      const u = rand(users);
      const options = ['fingerprint', 'fingerprint'];
      if (u.cardNumber) options.push('card', 'card');
      if (u.pin) options.push('pin');
      const method = rand(options);
      const credential = method === 'fingerprint' ? u.userId : method === 'card' ? u.cardNumber : u.pin;
      read = { method, credential, userId: u.userId };
    }
    read.at = new Date();
    read.doorNumber = 1;
    this.store.logs.push({ userId: read.userId ?? null, timestamp: read.at, method: read.method });
    if (this.store.logs.length > 1000) this.store.logs.shift();
    this.emit('read', read);
  }

  start() {
    if (this.timer || !this.interval) return;
    const tick = () => {
      // intervalo con variación aleatoria para que se vea natural
      this.timer = setTimeout(() => { this.generateRead(); tick(); }, this.interval * 1000 * (0.5 + Math.random()));
    };
    tick();
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
