/** Utilidades para RUT chileno (validación módulo 11) */
export function cleanRut(rut) {
  return String(rut || '').replace(/[^0-9kK]/g, '').toUpperCase();
}
export function computeDv(body) {
  let sum = 0;
  let mul = 2;
  for (let i = String(body).length - 1; i >= 0; i--) {
    sum += Number(String(body)[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const res = 11 - (sum % 11);
  return res === 11 ? '0' : res === 10 ? 'K' : String(res);
}
export function isValidRut(rut) {
  const c = cleanRut(rut);
  if (c.length < 2) return false;
  const body = c.slice(0, -1);
  const dv = c.slice(-1);
  if (!/^\d{6,8}$/.test(body)) return false;
  return computeDv(body) === dv;
}
/** Normaliza a "12345678-9" */
export function normalizeRut(rut) {
  const c = cleanRut(rut);
  return `${c.slice(0, -1)}-${c.slice(-1)}`;
}
export function formatRut(rut) {
  const c = cleanRut(rut);
  const body = c.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${body}-${c.slice(-1)}`;
}
