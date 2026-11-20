export const METHODS = { fingerprint: 'Huella', card: 'Tarjeta', pin: 'PIN', web: 'Web' };
export const ROLES = { super_admin: 'Super Admin', admin: 'Administrador', readonly: 'Solo lectura' };
export const LOCK_TYPES = { fail_safe: 'Fail-safe (abre sin energía)', fail_secure: 'Fail-secure (cierra sin energía)' };
export const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const ACTIONS = {
  create: 'Creó', update: 'Editó', delete: 'Eliminó', login: 'Inicio de sesión', login_failed: 'Login fallido',
  open: 'Abrió puerta', test: 'Probó conexión', sync: 'Sincronizó', import: 'Importó marcaciones',
  export: 'Exportó', backup: 'Respaldo', restore: 'Restauró', seed: 'Datos iniciales',
};
export const ENTITIES = {
  person: 'Persona', user: 'Usuario', door: 'Puerta', device: 'Dispositivo', group: 'Grupo', settings: 'Configuración',
  database: 'Base de datos', auth: 'Sesión', access_logs: 'Registros',
};

/** "2024-05-01 13:45:00" → "01-05-2024 13:45" */
export function fmtDateTime(s, withSeconds = false) {
  if (!s) return '—';
  const str = String(s);
  if (!/^\d{4}-\d{2}-\d{2}/.test(str)) return new Date(s).toLocaleString('es-CL');
  return `${str.slice(8, 10)}-${str.slice(5, 7)}-${str.slice(0, 4)} ${str.slice(11, withSeconds ? 19 : 16)}`.trim();
}
export function fmtDate(s) {
  if (!s) return '—';
  const str = String(s);
  return `${str.slice(8, 10)}-${str.slice(5, 7)}-${str.slice(0, 4)}`;
}
export function fmtTime(s) { return s ? String(s).slice(11, 19) : ''; }

export function cleanRut(rut) { return String(rut || '').replace(/[^0-9kK]/g, '').toUpperCase(); }
export function formatRut(rut) {
  const c = cleanRut(rut);
  if (c.length < 2) return c;
  return `${c.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${c.slice(-1)}`;
}
export function isValidRut(rut) {
  const c = cleanRut(rut);
  if (!/^\d{6,8}[0-9K]$/.test(c)) return false;
  let sum = 0, mul = 2;
  for (let i = c.length - 2; i >= 0; i--) { sum += Number(c[i]) * mul; mul = mul === 7 ? 2 : mul + 1; }
  const r = 11 - (sum % 11);
  return (r === 11 ? '0' : r === 10 ? 'K' : String(r)) === c.slice(-1);
}
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const daysAgo = (n) => {
  const d = new Date(); d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
export const fmtBytes = (b) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);
