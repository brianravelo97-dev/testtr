import { DeviceDriver } from './DeviceDriver.js';

/**
 * Abre una chapa mediante un relé HTTP en la red local (Shelly o ESP32).
 * No maneja usuarios: sólo apertura y verificación de conexión.
 *
 * Config (JSON en el dispositivo):
 *   { "relayType": "shelly_gen1" | "shelly_gen2" | "esp32",
 *     "channel": 0,
 *     "username": "admin", "password": "...",    // Shelly con autenticación básica (gen1)
 *     "token": "...",                            // ESP32: header X-Api-Key
 *     "openPath": "/open", "statusPath": "/status" } // ESP32 personalizado
 *
 * Firmware ESP32 sugerido: GET /status → 200 JSON, POST /open {seconds} → activa relé.
 */
export class RelayDriver extends DeviceDriver {
  static capabilities = { users: false, logs: false, open: true, realtime: false };

  get base() {
    const { ip, port } = this.device;
    if (!ip) throw new Error('El dispositivo no tiene IP configurada');
    return `http://${ip}${port && Number(port) !== 80 ? `:${port}` : ''}`;
  }

  get type() { return this.config.relayType || 'shelly_gen1'; }

  headers() {
    const h = { Accept: 'application/json' };
    if (this.config.username) {
      h.Authorization = 'Basic ' + Buffer.from(`${this.config.username}:${this.config.password || ''}`).toString('base64');
    }
    if (this.config.token) h['X-Api-Key'] = this.config.token;
    return h;
  }

  async request(path, options = {}) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), this.config.timeout || 4000);
    try {
      const res = await fetch(this.base + path, { ...options, headers: { ...this.headers(), ...(options.headers || {}) }, signal: controller.signal });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`);
      try { return JSON.parse(text); } catch { return { raw: text }; }
    } catch (err) {
      if (err.name === 'AbortError') throw new Error(`Tiempo de espera agotado al contactar ${this.base}`);
      throw err;
    } finally {
      clearTimeout(t);
    }
  }

  async connect() {
    const path = this.type === 'shelly_gen1' ? '/shelly' : this.type === 'shelly_gen2' ? '/rpc/Shelly.GetDeviceInfo' : (this.config.statusPath || '/status');
    const info = await this.request(path);
    return { model: info.type || info.model || info.app || this.device.model || 'Relé HTTP', firmware: info.fw || info.ver || info.version, raw: info };
  }

  async openDoor(doorNumber = 1, seconds = 3) {
    const ch = this.config.channel ?? Math.max(0, doorNumber - 1);
    if (this.type === 'shelly_gen1') {
      await this.request(`/relay/${ch}?turn=on&timer=${seconds}`);
    } else if (this.type === 'shelly_gen2') {
      await this.request(`/rpc/Switch.Set?id=${ch}&on=true&toggle_after=${seconds}`);
    } else {
      await this.request(this.config.openPath || '/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relay: ch, seconds }),
      });
    }
    return { opened: true, seconds };
  }
}
