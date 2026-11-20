const ADMIN_KEY = 'ca_token';
const PERSON_KEY = 'ca_person_token';

export const tokens = {
  get admin() { try { return localStorage.getItem(ADMIN_KEY); } catch { return null; } },
  set admin(v) { try { v ? localStorage.setItem(ADMIN_KEY, v) : localStorage.removeItem(ADMIN_KEY); } catch { /* */ } },
  get person() { try { return localStorage.getItem(PERSON_KEY); } catch { return null; } },
  set person(v) { try { v ? localStorage.setItem(PERSON_KEY, v) : localStorage.removeItem(PERSON_KEY); } catch { /* */ } },
};

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

export class ApiError extends Error {
  constructor(status, message, details) { super(message); this.status = status; this.details = details; }
}

async function request(method, url, { body, token = tokens.admin, form, raw } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  let res;
  try {
    res = await fetch(`/api${url}`, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor');
  }
  if (raw && res.ok) return res;
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) {
    if (res.status === 401 && token === tokens.admin && !url.startsWith('/auth/login')) onUnauthorized();
    throw new ApiError(res.status, data?.error || `Error ${res.status}`, data?.details);
  }
  return data;
}

export const api = {
  get: (url, opts) => request('GET', url, opts),
  post: (url, body, opts) => request('POST', url, { ...opts, body }),
  put: (url, body, opts) => request('PUT', url, { ...opts, body }),
  del: (url, opts) => request('DELETE', url, opts),
  upload: (url, form, opts) => request('POST', url, { ...opts, form }),
  /** Descarga un archivo autenticado */
  async download(url, fallbackName) {
    const res = await request('GET', url, { raw: true });
    const blob = await res.blob();
    const cd = res.headers.get('content-disposition') || '';
    const name = /filename="?([^"]+)"?/.exec(cd)?.[1] || fallbackName;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },
};

export const qs = (obj) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) if (v !== '' && v != null) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
};
