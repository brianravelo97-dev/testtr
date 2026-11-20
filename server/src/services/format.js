import { toLocal } from '../utils/time.js';

/** "2024-05-01 13:45:00" → "01-05-2024 13:45:00" (formato Chile) */
export function formatTs(v) {
  const s = v instanceof Date ? toLocal(v) : String(v || '');
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return s;
  return `${s.slice(8, 10)}-${s.slice(5, 7)}-${s.slice(0, 4)}${s.slice(10)}`;
}
