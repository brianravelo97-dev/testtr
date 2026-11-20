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
    <div className="flex h-full flex-col bg-slate-900 text-slate-300 dark:bg-slate-900/60">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white"><KeyRound size={20} /></div>
        <div>
          <div className="text-sm font-bold text-white">Control de Acceso</div>
          <div className="text-xs text-slate-400">Sistema local</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}
            className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-blue-600 text-white shadow' : 'hover:bg-slate-800 hover:text-white'}`}>
            <n.icon size={18} /> {n.label}
          </NavLink>
        ))}
        <div className="my-3 border-t border-slate-800" />
        <a href="/abrir" target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-slate-800 hover:text-white">
          <Smartphone size={18} /> Portal de apertura
        </a>
      </nav>
      <div className="border-t border-slate-800 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <Avatar name={user?.name} size={34} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-white">{user?.name}</div>
            <div className="text-xs text-slate-400">{ROLES[user?.role]}</div>
          </div>
          <button onClick={logout} className="rounded-lg p-2 hover:bg-slate-800 hover:text-white" title="Cerrar sesión" aria-label="Cerrar sesión"><LogOut size={17} /></button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-full">
      <aside className="hidden w-64 shrink-0 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 shadow-xl">{sidebar}</aside>
          <button className="absolute right-4 top-4 rounded-lg bg-slate-800 p-2 text-white" onClick={() => setOpen(false)} aria-label="Cerrar menú"><X size={18} /></button>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
          <button className="btn-ghost -ml-2 p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menú"><Menu size={20} /></button>
          <div className="text-sm font-medium text-slate-500 lg:hidden">Control de Acceso</div>
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
