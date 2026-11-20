const pad = (n) => String(n).padStart(2, '0');

/** Fecha local en formato "YYYY-MM-DD HH:MM:SS" (zona horaria del servidor, TZ en .env) */
export function toLocal(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
export const nowLocal = () => toLocal(new Date());
export function dateOnly(date = new Date()) {
  return toLocal(date).slice(0, 10);
}
export function hhmm(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
