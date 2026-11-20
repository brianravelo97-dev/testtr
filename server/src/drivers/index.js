import { SimulatorDriver } from './SimulatorDriver.js';
import { ZKTecoDriver } from './ZKTecoDriver.js';
import { RelayDriver } from './RelayDriver.js';
import { config } from '../config.js';

export const DRIVERS = {
  simulator: { label: 'Simulador (sin hardware)', cls: SimulatorDriver },
  zkteco: { label: 'ZKTeco (node-zklib)', cls: ZKTecoDriver },
  relay: { label: 'Relé HTTP (Shelly / ESP32)', cls: RelayDriver },
};

export function createDriver(device) {
  const entry = DRIVERS[device.driver];
  if (!entry) throw new Error(`Driver desconocido: ${device.driver}`);
  const parsed = { ...device, config: typeof device.config === 'string' ? safeJson(device.config) : device.config || {} };
  return new entry.cls(parsed, { interval: config.simInterval });
}

export function driverList() {
  return Object.entries(DRIVERS).map(([id, d]) => ({ id, label: d.label, capabilities: d.cls.capabilities }));
}

function safeJson(s) {
  try { return JSON.parse(s || '{}'); } catch { return {}; }
}
