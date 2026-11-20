import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Fingerprint, CreditCard, Hash, Globe } from 'lucide-react';
import { api } from '../lib/api.js';
import { useRealtime } from '../lib/useRealtime.js';
import { METHODS, fmtDateTime } from '../lib/format.js';
import { PageHeader, Loading, Avatar, ResultBadge, StatusDot, Empty } from '../components/ui.jsx';
import { useTheme } from '../context/ThemeContext.jsx';

const METHOD_ICON = { fingerprint: Fingerprint, card: CreditCard, pin: Hash, web: Globe };
const C_NO = '#b91c1c';

function Stat({ label, value, sub }) {
  return (
    <div className="card p-4 sm:p-5">
      <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-neutral-500">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [flashId, setFlashId] = useState(null);
  const { theme } = useTheme();
  const grid = theme === 'dark' ? '#262626' : '#e5e5e5';
  const axis = theme === 'dark' ? '#a3a3a3' : '#737373';
  const cOk = theme === 'dark' ? '#d4d4d4' : '#262626';

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
  const tooltipStyle = { backgroundColor: theme === 'dark' ? '#171717' : '#fff', border: `1px solid ${grid}`, borderRadius: 2, fontSize: 12 };

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Resumen de la actividad de hoy"
        actions={<span className="inline-flex items-center gap-2 text-xs text-neutral-500">
          <span className={`h-2 w-2 ${live ? 'bg-green-700 dark:bg-green-500' : 'bg-neutral-400'}`} /> {live ? 'Conectado en tiempo real' : 'Reconectando…'}
        </span>} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat label="Permitidos hoy" value={stats.accessToday} />
        <Stat label="Denegados hoy" value={<span className={stats.deniedToday ? 'text-red-700 dark:text-red-500' : ''}>{stats.deniedToday}</span>} />
        <Stat label="Dispositivos" value={<span>{stats.devicesOnline}<span className="text-lg font-normal text-neutral-400"> / {stats.devicesOnline + stats.devicesOffline}</span></span>} sub={stats.devicesOffline ? `${stats.devicesOffline} sin conexión` : 'Todos en línea'} />
        <Stat label="Personas activas" value={stats.peopleActive} sub={`de ${stats.peopleTotal} registradas`} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="card p-4 sm:p-5">
          <h2 className="mb-4 text-sm font-medium">Accesos por hora (hoy)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.hourly} margin={{ left: -20, right: 8, top: 4 }}>
                <CartesianGrid stroke={grid} vertical={false} />
                <XAxis dataKey="hour" tick={{ fill: axis, fontSize: 11 }} interval={2} tickLine={false} axisLine={{ stroke: grid }} />
                <YAxis allowDecimals={false} tick={{ fill: axis, fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} iconType="plainline" />
                <Line type="linear" dataKey="granted" name="Permitidos" stroke={cOk} strokeWidth={1.75} dot={false} />
                <Line type="linear" dataKey="denied" name="Denegados" stroke={C_NO} strokeWidth={1.75} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-4 sm:p-5">
          <h2 className="mb-4 text-sm font-medium">Accesos por día (últimos 7 días)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.daily} margin={{ left: -20, right: 8, top: 4 }}>
                <CartesianGrid stroke={grid} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: axis, fontSize: 11 }} tickLine={false} axisLine={{ stroke: grid }} />
                <YAxis allowDecimals={false} tick={{ fill: axis, fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: theme === 'dark' ? '#262626' : '#f5f5f5' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} iconType="square" />
                <Bar dataKey="granted" name="Permitidos" stackId="a" fill={cOk} />
                <Bar dataKey="denied" name="Denegados" stackId="a" fill={C_NO} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="card overflow-hidden xl:col-span-2">
          <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
            <h2 className="text-sm font-medium">Últimos 10 eventos</h2>
            <Link to="/registros" className="text-xs text-neutral-600 underline-offset-2 hover:underline dark:text-neutral-400">Ver todos</Link>
          </div>
          {data.recent.length === 0 ? <Empty text="Aún no hay eventos" /> : (
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {data.recent.map((e) => {
                const Icon = METHOD_ICON[e.method] || Fingerprint;
                return (
                  <li key={e.id} className={`flex items-center gap-3 px-5 py-3 ${flashId === e.id ? 'flash' : ''}`}>
                    <Avatar name={e.person_name || '?'} photo={e.photo} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{e.person_name || <span className="text-neutral-400">Desconocido</span>}</div>
                      <div className="flex items-center gap-1.5 truncate text-xs text-neutral-500"><Icon size={12} /> {METHODS[e.method]} · {e.door_name} · <span className="truncate">{e.reason}</span></div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <ResultBadge result={e.result} />
                      <span className="text-xs tabular-nums text-neutral-400">{fmtDateTime(e.ts, true).slice(11)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="mb-3 text-sm font-medium">Dispositivos</h2>
            <ul className="space-y-2.5">
              {data.devices.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2"><StatusDot online={d.status === 'online'} /><span className="truncate">{d.name}</span></span>
                  <span className={`text-xs ${d.status === 'online' ? 'text-neutral-500' : 'text-red-700 dark:text-red-500'}`}>{d.status === 'online' ? 'En línea' : 'Sin conexión'}</span>
                </li>
              ))}
              {data.devices.length === 0 && <li className="text-sm text-neutral-400">Sin dispositivos</li>}
            </ul>
          </div>
          <div className="card p-5">
            <h2 className="mb-3 text-sm font-medium">Motivos de rechazo (7 días)</h2>
            <ul className="space-y-2">
              {data.topDenied.map((r) => {
                const max = data.topDenied[0]?.c || 1;
                return (
                  <li key={r.reason} className="text-xs">
                    <div className="mb-1 flex justify-between"><span className="truncate">{r.reason}</span><span className="tabular-nums text-neutral-500">{r.c}</span></div>
                    <div className="h-1 bg-neutral-100 dark:bg-neutral-800"><div className="h-1 bg-neutral-500" style={{ width: `${(r.c / max) * 100}%` }} /></div>
                  </li>
                );
              })}
              {data.topDenied.length === 0 && <li className="text-sm text-neutral-400">Sin rechazos</li>}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
