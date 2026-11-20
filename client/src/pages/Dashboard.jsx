import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CheckCircle2, XCircle, Wifi, WifiOff, Users, Fingerprint, CreditCard, Hash, Globe, Radio } from 'lucide-react';
import { api } from '../lib/api.js';
import { useRealtime } from '../lib/useRealtime.js';
import { METHODS, fmtDateTime } from '../lib/format.js';
import { PageHeader, Loading, Avatar, ResultBadge, StatusDot, Empty } from '../components/ui.jsx';
import { useTheme } from '../context/ThemeContext.jsx';

const METHOD_ICON = { fingerprint: Fingerprint, card: CreditCard, pin: Hash, web: Globe };
const C_OK = '#2563eb';
const C_NO = '#e11d48';

function Stat({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="card flex items-center gap-4 p-4 sm:p-5">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${color}`}><Icon size={22} /></div>
      <div className="min-w-0">
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        <div className="truncate text-xs text-slate-500 dark:text-slate-400">{label}</div>
        {sub && <div className="text-xs text-slate-400">{sub}</div>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [flashId, setFlashId] = useState(null);
  const { theme } = useTheme();
  const grid = theme === 'dark' ? '#1e293b' : '#e2e8f0';
  const axis = theme === 'dark' ? '#94a3b8' : '#64748b';

  const load = useCallback(() => api.get('/dashboard').then(setData).catch(() => {}), []);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  const live = useRealtime((msg) => {
    if (msg.type === 'access') {
      setFlashId(msg.data.id);
      setData((d) => {
        if (!d) return d;
        const granted = msg.data.result === 'granted';
        const hour = Number(msg.data.ts.slice(11, 13));
        const hourly = d.hourly.map((h, i) => (i === hour ? { ...h, [granted ? 'granted' : 'denied']: h[granted ? 'granted' : 'denied'] + 1 } : h));
        const daily = d.daily.map((x) => (x.day === msg.data.ts.slice(0, 10) ? { ...x, [granted ? 'granted' : 'denied']: x[granted ? 'granted' : 'denied'] + 1 } : x));
        return {
          ...d, hourly, daily,
          recent: [msg.data, ...d.recent].slice(0, 10),
          stats: { ...d.stats, accessToday: d.stats.accessToday + (granted ? 1 : 0), deniedToday: d.stats.deniedToday + (granted ? 0 : 1) },
        };
      });
    }
    if (msg.type === 'device_status') load();
  });

  if (!data) return <Loading />;
  const { stats } = data;
  const tooltipStyle = { backgroundColor: theme === 'dark' ? '#0f172a' : '#fff', border: `1px solid ${grid}`, borderRadius: 8, fontSize: 12 };

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Resumen de la actividad de hoy"
        actions={<span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${live ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
          <span className={`relative h-2 w-2 rounded-full ${live ? 'bg-emerald-500 pulse-ring text-emerald-500' : 'bg-slate-400'}`} /> {live ? 'En vivo' : 'Reconectando…'}
        </span>} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat icon={CheckCircle2} label="Accesos permitidos hoy" value={stats.accessToday} color="bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400" />
        <Stat icon={XCircle} label="Accesos denegados hoy" value={stats.deniedToday} color="bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400" />
        <Stat icon={stats.devicesOffline ? WifiOff : Wifi} label="Dispositivos online / offline" value={<span>{stats.devicesOnline}<span className="text-slate-400"> / </span><span className={stats.devicesOffline ? 'text-red-500' : ''}>{stats.devicesOffline}</span></span>} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" />
        <Stat icon={Users} label="Personas activas" value={stats.peopleActive} sub={`de ${stats.peopleTotal} registradas`} color="bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="card p-4 sm:p-5">
          <h2 className="mb-4 text-sm font-semibold">Accesos por hora (hoy)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.hourly} margin={{ left: -20, right: 8, top: 4 }}>
                <defs>
                  <linearGradient id="gOk" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C_OK} stopOpacity={0.35} /><stop offset="100%" stopColor={C_OK} stopOpacity={0} /></linearGradient>
                  <linearGradient id="gNo" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C_NO} stopOpacity={0.3} /><stop offset="100%" stopColor={C_NO} stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid stroke={grid} vertical={false} />
                <XAxis dataKey="hour" tick={{ fill: axis, fontSize: 11 }} interval={2} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: axis, fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="granted" name="Permitidos" stroke={C_OK} strokeWidth={2} fill="url(#gOk)" />
                <Area type="monotone" dataKey="denied" name="Denegados" stroke={C_NO} strokeWidth={2} fill="url(#gNo)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-4 sm:p-5">
          <h2 className="mb-4 text-sm font-semibold">Accesos por día (últimos 7 días)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.daily} margin={{ left: -20, right: 8, top: 4 }}>
                <CartesianGrid stroke={grid} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: axis, fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: axis, fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: theme === 'dark' ? '#1e293b' : '#f1f5f9' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="granted" name="Permitidos" stackId="a" fill={C_OK} />
                <Bar dataKey="denied" name="Denegados" stackId="a" fill={C_NO} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="card overflow-hidden xl:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><Radio size={16} className="text-blue-500" /> Últimos 10 eventos</h2>
            <Link to="/registros" className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">Ver todos</Link>
          </div>
          {data.recent.length === 0 ? <Empty text="Aún no hay eventos" /> : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.recent.map((e) => {
                const Icon = METHOD_ICON[e.method] || Fingerprint;
                return (
                  <li key={e.id} className={`flex items-center gap-3 px-5 py-3 ${flashId === e.id ? 'flash' : ''}`}>
                    <Avatar name={e.person_name || '?'} photo={e.photo} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{e.person_name || <span className="text-slate-400">Desconocido</span>}</div>
                      <div className="flex items-center gap-1.5 truncate text-xs text-slate-500"><Icon size={12} /> {METHODS[e.method]} · {e.door_name} · <span className="truncate">{e.reason}</span></div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <ResultBadge result={e.result} />
                      <span className="text-xs tabular-nums text-slate-400">{fmtDateTime(e.ts, true).slice(11)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="mb-3 text-sm font-semibold">Dispositivos</h2>
            <ul className="space-y-2.5">
              {data.devices.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2"><StatusDot online={d.status === 'online'} /><span className="truncate">{d.name}</span></span>
                  <span className={`text-xs ${d.status === 'online' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{d.status === 'online' ? 'Online' : 'Offline'}</span>
                </li>
              ))}
              {data.devices.length === 0 && <li className="text-sm text-slate-400">Sin dispositivos</li>}
            </ul>
          </div>
          <div className="card p-5">
            <h2 className="mb-3 text-sm font-semibold">Motivos de rechazo (7 días)</h2>
            <ul className="space-y-2">
              {data.topDenied.map((r) => {
                const max = data.topDenied[0]?.c || 1;
                return (
                  <li key={r.reason} className="text-xs">
                    <div className="mb-1 flex justify-between"><span className="truncate">{r.reason}</span><span className="tabular-nums text-slate-500">{r.c}</span></div>
                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-1.5 rounded-full bg-rose-500" style={{ width: `${(r.c / max) * 100}%` }} /></div>
                  </li>
                );
              })}
              {data.topDenied.length === 0 && <li className="text-sm text-slate-400">Sin rechazos</li>}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
