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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`flex max-h-[95vh] w-full ${widths[size]} flex-col rounded-t-2xl bg-white shadow-xl dark:bg-slate-900 sm:rounded-2xl`} role="dialog" aria-modal="true">
        {title && (
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <h2 className="text-base font-semibold">{title}</h2>
            <button className="btn-ghost -mr-2 p-1.5" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
          </div>
        )}
        <div className="overflow-y-auto">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const BADGE = {
  green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  red: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  yellow: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  gray: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  purple: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400',
};
export function Badge({ color = 'gray', children, className = '' }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[color]} ${className}`}>{children}</span>;
}

export function StatusDot({ online }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-red-500'}`} />;
}

export function Spinner({ className = '' }) {
  return <Loader2 className={`animate-spin ${className}`} size={18} />;
}

export function Loading() {
  return <div className="flex items-center justify-center gap-2 py-16 text-slate-500"><Spinner /> Cargando…</div>;
}

export function Empty({ text = 'Sin resultados', icon: Icon = Inbox }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-slate-400">
      <Icon size={32} strokeWidth={1.5} />
      <p className="text-sm">{text}</p>
    </div>
  );
}

export function Pagination({ page, pageSize, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  return (
    <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
      <span className="text-slate-500">{from}–{Math.min(total, page * pageSize)} de {total.toLocaleString('es-CL')}</span>
      <div className="flex items-center gap-1">
        <button className="btn-ghost p-1.5" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Anterior"><ChevronLeft size={18} /></button>
        <span className="px-2 text-slate-600 dark:text-slate-300">{page} / {pages}</span>
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
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : hint ? <span className="mt-1 block text-xs text-slate-400">{hint}</span> : null}
    </label>
  );
}

export function Toggle({ checked, onChange, label, disabled }) {
  return (
    <label className={`inline-flex cursor-pointer items-center gap-3 ${disabled ? 'opacity-50' : ''}`}>
      <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
      {label && <span className="text-sm">{label}</span>}
    </label>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Buscar…', className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input className="input pl-9" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

export function Avatar({ name, photo, size = 36 }) {
  if (photo) return <img src={photo} alt={name} style={{ width: size, height: size }} className="shrink-0 rounded-full object-cover" />;
  return (
    <div style={{ width: size, height: size, fontSize: size * 0.38 }} className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 font-semibold text-white">
      {initials(name) || '?'}
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${value === t.id ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>
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
