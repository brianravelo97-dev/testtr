import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Loader2, Search, X, Inbox } from 'lucide-react';
import { initials } from '../lib/format.js';

export function Modal({ open, onClose, title, children, size = 'md', footer }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-950/40 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`flex max-h-[95vh] w-full ${widths[size]} flex-col border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900`} role="dialog" aria-modal="true">
        {title && (
          <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
            <h2 className="text-base font-semibold">{title}</h2>
            <button className="btn-ghost -mr-2 p-1.5" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
          </div>
        )}
        <div className="overflow-y-auto">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-3 dark:border-neutral-800">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const DOT = { green: 'bg-green-700 dark:bg-green-500', red: 'bg-red-700 dark:bg-red-500', yellow: 'bg-amber-600 dark:bg-amber-500' };
/** Etiqueta sobria: borde gris y, sólo para estados, un pequeño indicador */
export function Badge({ color = 'gray', children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap border border-neutral-300 px-1.5 py-0.5 text-xs text-neutral-700 dark:border-neutral-700 dark:text-neutral-300 ${className}`}>
      {DOT[color] && <span className={`h-1.5 w-1.5 ${DOT[color]}`} />}{children}
    </span>
  );
}

export function StatusDot({ online }) {
  return <span className={`inline-block h-2 w-2 ${online ? 'bg-green-700 dark:bg-green-500' : 'bg-red-700 dark:bg-red-500'}`} />;
}

export function Spinner({ className = '' }) {
  return <Loader2 className={`animate-spin ${className}`} size={18} />;
}

export function Loading() {
  return <div className="flex items-center justify-center gap-2 py-16 text-neutral-500"><Spinner /> Cargando…</div>;
}

export function Empty({ text = 'Sin resultados', icon: Icon = Inbox }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-neutral-400">
      <Icon size={32} strokeWidth={1.5} />
      <p className="text-sm">{text}</p>
    </div>
  );
}

export function Pagination({ page, pageSize, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  return (
    <div className="flex items-center justify-between gap-2 border-t border-neutral-200 px-4 py-3 text-sm dark:border-neutral-800">
      <span className="text-neutral-500">{from}–{Math.min(total, page * pageSize)} de {total.toLocaleString('es-CL')}</span>
      <div className="flex items-center gap-1">
        <button className="btn-ghost p-1.5" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Anterior"><ChevronLeft size={18} /></button>
        <span className="px-2 text-neutral-600 dark:text-neutral-300">{page} / {pages}</span>
        <button className="btn-ghost p-1.5" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Siguiente"><ChevronRight size={18} /></button>
      </div>
    </div>
  );
}

export function Field({ label, error, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="label">{label}</span>}
      {children}
      {error ? <span className="mt-1 block text-xs text-red-700 dark:text-red-500">{error}</span> : hint ? <span className="mt-1 block text-xs text-neutral-400">{hint}</span> : null}
    </label>
  );
}

export function Toggle({ checked, onChange, label, disabled }) {
  return (
    <label className={`inline-flex cursor-pointer items-center gap-2.5 ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}>
      <input type="checkbox" className="h-4 w-4 accent-neutral-900 dark:accent-neutral-200" checked={!!checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label && <span className="text-sm">{label}</span>}
    </label>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Buscar…', className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -tranneutral-y-1/2 text-neutral-400" />
      <input className="input pl-9" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

export function Avatar({ name, photo, size = 36 }) {
  if (photo) return <img src={photo} alt={name} style={{ width: size, height: size }} className="shrink-0 object-cover" />;
  return (
    <div style={{ width: size, height: size, fontSize: size * 0.38 }} className="flex shrink-0 items-center justify-center bg-neutral-200 font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
      {initials(name) || '?'}
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto border-b border-neutral-200 dark:border-neutral-800">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${value === t.id ? 'border-neutral-900 text-neutral-900 dark:border-neutral-100 dark:text-neutral-100' : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'}`}>
          {t.icon && <t.icon size={16} />}{t.label}
        </button>
      ))}
    </div>
  );
}

export function ResultBadge({ result }) {
  return result === 'granted' ? <Badge color="green">Permitido</Badge> : <Badge color="red">Denegado</Badge>;
}

/** Hook utilitario: debounce de un valor */
export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
