import crypto from 'node:crypto';
import { config } from '../config.js';

/**
 * Los PIN de personas se guardan cifrados (AES-256-GCM) porque deben poder
 * enviarse al lector al sincronizar. Nunca se devuelven por la API.
 */
export function encryptPin(pin) {
  if (!pin) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', config.pinKey, iv);
  const enc = Buffer.concat([cipher.update(String(pin), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decryptPin(value) {
  if (!value) return null;
  try {
    const [iv, tag, enc] = value.split(':').map((p) => Buffer.from(p, 'base64'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', config.pinKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

export function safeEqual(a, b) {
  const ba = Buffer.from(String(a ?? ''));
  const bb = Buffer.from(String(b ?? ''));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export const randomToken = (bytes = 24) => crypto.randomBytes(bytes).toString('base64url');
