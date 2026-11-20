import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, CalendarClock, DoorOpen, Cpu, ScrollText, ShieldCheck, Settings,
  Menu, X, LogOut, Moon, Sun, Smartphone, KeyRound,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { ROLES } from '../lib/format.js';
import { Avatar } from './ui.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/personas', label: 'Personas', icon: Users },
  { to: '/grupos', label: 'Grupos y horarios', icon: CalendarClock },
  { to: '/puertas', label: 'Puertas', icon: DoorOpen },
  { to: '/dispositivos', label: 'Dispositivos', icon: Cpu },
  { to: '/registros', label: 'Registros', icon: ScrollText },
  { to: '/auditoria', label: 'Auditoría', icon: ShieldCheck },
  { to: '/configuracion', label: 'Configuración', icon: Settings },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);

  const sidebar = (
    <div className="flex h-full flex-col border-r border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex h-14 items-center gap-2.5 border-b border-neutral-200 px-5 dark:border-neutral-800">
        <KeyRound size={18} className="text-neutral-500" />
        <span className="text-sm font-semibold tracking-tight">Control de Acceso</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-3">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}
            className={({ isActive }) => `flex items-center gap-3 border-l-2 px-5 py-2 text-sm transition ${isActive
              ? 'border-neutral-900 bg-neutral-100 font-medium text-neutral-900 dark:border-neutral-100 dark:bg-neutral-800 dark:text-neutral-100'
              : 'border-transparent text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/60 dark:hover:text-neutral-100'}`}>
            <n.icon size={17} strokeWidth={1.75} /> {n.label}
          </NavLink>
        ))}
        <div className="mx-5 my-3 border-t border-neutral-200 dark:border-neutral-800" />
        <a href="/abrir" target="_blank" rel="noreferrer" className="flex items-center gap-3 border-l-2 border-transparent px-5 py-2 text-sm text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/60 dark:hover:text-neutral-100">
          <Smartphone size={17} strokeWidth={1.75} /> Portal de apertura
        </a>
      </nav>
      <div className="flex items-center gap-3 border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <Avatar name={user?.name} size={32} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{user?.name}</div>
          <div className="text-xs text-neutral-500">{ROLES[user?.role]}</div>
        </div>
        <button onClick={logout} className="btn-ghost p-2" title="Cerrar sesión" aria-label="Cerrar sesión"><LogOut size={16} /></button>
      </div>
    </div>
  );

  return (
    <div className="flex h-full">
      <aside className="hidden w-64 shrink-0 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-neutral-950/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72">{sidebar}</aside>
          <button className="absolute right-4 top-4 border border-neutral-300 bg-white p-2 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200" onClick={() => setOpen(false)} aria-label="Cerrar menú"><X size={18} /></button>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-neutral-200 bg-white px-4 dark:border-neutral-800 dark:bg-neutral-900">
          <button className="btn-ghost -ml-2 p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menú"><Menu size={20} /></button>
          <div className="text-sm font-medium text-neutral-500 lg:hidden">Control de Acceso</div>
          <div className="flex-1" />
          <button onClick={toggle} className="btn-ghost p-2" title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'} aria-label="Cambiar tema">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8"><Outlet /></div>
        </main>
      </div>
    </div>
  );
}
