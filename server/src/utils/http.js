export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
export const badRequest = (msg, details) => new HttpError(400, msg, details);
export const notFound = (msg = 'Recurso no encontrado') => new HttpError(404, msg);
export const forbidden = (msg = 'No tiene permisos para esta acción') => new HttpError(403, msg);

/** Envuelve handlers async para capturar errores */
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Valida con un schema zod y lanza 400 con mensajes en español */
export function parse(schema, data) {
  const r = schema.safeParse(data);
  if (!r.success) {
    const issues = r.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    throw badRequest(issues[0] ? `${issues[0].field ? issues[0].field + ': ' : ''}${issues[0].message}` : 'Datos inválidos', issues);
  }
  return r.data;
}

export function paging(query, maxSize = 100) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(maxSize, Math.max(1, parseInt(query.pageSize, 10) || 10));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

/** Convierte una cadena vacía a null */
export const emptyToNull = (v) => (v === '' || v === undefined ? null : v);
