import { EventEmitter } from 'node:events';

/**
 * Interfaz base para todos los drivers de dispositivos.
 *
 * Modelo de usuario del dispositivo:
 *   { userId: string, name: string, cardNumber?: string, pin?: string, role?: number }
 *   userId corresponde al "ID de huella" (número de usuario en el lector).
 *
 * Modelo de marcación (getAttendanceLogs):
 *   { userId: string, timestamp: Date, method: 'fingerprint'|'card'|'pin', door?: number }
 *
 * Eventos emitidos (opcional, para lectores con tiempo real):
 *   'read' → { method, credential, doorNumber?, at: Date }
 */
export class DeviceDriver extends EventEmitter {
  /** @param {object} device fila de la tabla devices (config ya parseado) */
  constructor(device) {
    super();
    this.device = device;
    this.config = device.config || {};
  }

  /** Capacidades soportadas, para que la interfaz muestre u oculte acciones */
  static capabilities = { users: false, logs: false, open: false, realtime: false };
  get capabilities() { return this.constructor.capabilities; }

  notSupported(name) {
    const err = new Error(`La operación "${name}" no está soportada por el driver ${this.constructor.name}`);
    err.status = 400;
    return err;
  }

  /** Abre conexión y devuelve información del equipo { model, serial, firmware, users, ... } */
  async connect() { throw this.notSupported('connect'); }
  async disconnect() {}
  /** @returns {Promise<Array<{userId:string,name:string,cardNumber?:string}>>} */
  async getUsers() { throw this.notSupported('getUsers'); }
  async addUser(_user) { throw this.notSupported('addUser'); }
  async deleteUser(_userId) { throw this.notSupported('deleteUser'); }
  async setCard(_userId, _cardNumber) { throw this.notSupported('setCard'); }
  /** Abre la chapa/relé. doorNumber: número de relé/puerta del equipo. seconds: tiempo de apertura */
  async openDoor(_doorNumber = 1, _seconds = 3) { throw this.notSupported('openDoor'); }
  async getAttendanceLogs() { throw this.notSupported('getAttendanceLogs'); }
  /** Inicia/detiene procesos en segundo plano (simulación, tiempo real) */
  start() {}
  stop() {}
}
