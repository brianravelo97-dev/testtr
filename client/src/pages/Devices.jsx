import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Cpu, Plug, RefreshCw, Download, Users, Wifi, WifiOff } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useConfirm } from '../context/ConfirmContext.jsx';
import { useRealtime } from '../lib/useRealtime.js';
import { fmtDateTime } from '../lib/format.js';
import { PageHeader, Modal, Field, Loading, Empty, Spinner, Badge, Toggle } from '../components/ui.jsx';

const EMPTY = { name: '', brand: '', model: '', ip: '', port: '', driver: 'simulator', config: {} };

function DriverConfig({ driver, config, onChange }) {
  const set = (k, v) => onChange({ ...config, [k]: v });
  if (driver === 'simulator') return (
    <div className="space-y-4 sm:col-span-2">
      <Toggle checked={!!config.offline} onChange={(v) => set('offline', v)} label="Simular equipo desconectado (offline)" />
      <Field label="Probabilidad de credencial desconocida (0 a 1)" hint="Porcentaje de lecturas aleatorias que serán rechazadas por tarjeta no registrada">
        <input type="number" step="0.05" min="0" max="1" className="input" value={config.unknownRate ?? 0.1} onChange={(e) => set('unknownRate', Number(e.target.value))} />
      </Field>
    </div>
  );
  if (driver === 'zkteco') return (
    <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
      <Field label="Timeout (ms)"><input type="number" className="input" value={config.timeout ?? 10000} onChange={(e) => set('timeout', Number(e.target.value))} /></Field>
      <Field label="Puerto local UDP (inport)"><input type="number" className="input" value={config.inport ?? 4000} onChange={(e) => set('inport', Number(e.target.value))} /></Field>
      <div className="sm:col-span-2"><Toggle checked={!!config.realtime} onChange={(v) => set('realtime', v)} label="Escuchar marcaciones en tiempo real" /></div>
      <p className="text-xs text-slate-500 sm:col-span-2">Puerto por defecto de ZKTeco: 4370. Requiere la librería opcional <code>node-zklib</code>.</p>
    </div>
  );
  return (
    <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
      <Field label="Tipo de relé">
        <select className="input" value={config.relayType || 'shelly_gen1'} onChange={(e) => set('relayType', e.target.value)}>
          <option value="shelly_gen1">Shelly Gen1 (/relay/0)</option>
          <option value="shelly_gen2">Shelly Plus/Pro Gen2 (RPC)</option>
          <option value="esp32">ESP32 / HTTP personalizado</option>
        </select>
      </Field>
      <Field label="Canal del relé"><input type="number" min="0" className="input" value={config.channel ?? 0} onChange={(e) => set('channel', Number(e.target.value))} /></Field>
      {config.relayType === 'esp32' ? (
        <>
          <Field label="Ruta de apertura (POST)"><input className="input" value={config.openPath || '/open'} onChange={(e) => set('openPath', e.target.value)} /></Field>
          <Field label="Ruta de estado (GET)"><input className="input" value={config.statusPath || '/status'} onChange={(e) => set('statusPath', e.target.value)} /></Field>
          <Field label="Token (header X-Api-Key)" className="sm:col-span-2"><input className="input" type="password" value={config.token || ''} onChange={(e) => set('token', e.target.value)} /></Field>
        </>
      ) : (
        <>
          <Field label="Usuario (opcional)"><input className="input" value={config.username || ''} onChange={(e) => set('username', e.target.value)} /></Field>
          <Field label="Contraseña (opcional)"><input className="input" type="password" value={config.password || ''} onChange={(e) => set('password', e.target.value)} /></Field>
        </>
      )}
    </div>
  );
}

function DeviceForm({ device, drivers, onClose, onSaved }) {
  const [f, setF] = useState(device ? { ...EMPTY, ...device, brand: device.brand || '', model: device.model || '', ip: device.ip || '', port: device.port ?? '' } : EMPTY);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const changeDriver = (driver) => setF({ ...f, driver, config: {}, port: f.port || (driver === 'zkteco' ? 4370 : driver === 'relay' ? 80 : '') });
  const submit = async (e) => {
    e?.preventDefault();
    setBusy(true);
    try {
      const body = { name: f.name, brand: f.brand, model: f.model, ip: f.ip, port: f.port === '' ? null : Number(f.port), driver: f.driver, config: f.config };
      device ? await api.put(`/devices/${device.id}`, body) : await api.post('/devices', body);
      toast.success(device ? 'Dispositivo actualizado' : 'Dispositivo creado');
      onSaved();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={device ? 'Editar dispositivo' : 'Nuevo dispositivo'} size="lg"
      footer={<><button className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" onClick={submit} disabled={busy}>{busy && <Spinner />} Guardar</button></>}>
      <form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Nombre *" className="sm:col-span-2"><input className="input" value={f.name} onChange={set('name')} autoFocus /></Field>
        <Field label="Driver *" className="sm:col-span-2">
          <div className="grid gap-2 sm:grid-cols-3">
            {drivers.map((d) => (
              <button type="button" key={d.id} onClick={() => changeDriver(d.id)}
                className={`rounded-lg border p-3 text-left text-sm transition ${f.driver === d.id ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/20 dark:bg-blue-500/10' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'}`}>
                <div className="font-medium">{d.label}</div>
                <div className="mt-1 text-xs text-slate-500">{[d.capabilities.users && 'usuarios', d.capabilities.open && 'apertura', d.capabilities.logs && 'marcaciones'].filter(Boolean).join(' · ')}</div>
              </button>
            ))}
          </div>
        </Field>
        <Field label="Marca"><input className="input" value={f.brand} onChange={set('brand')} placeholder="ZKTeco, Shelly, ESP32…" /></Field>
        <Field label="Modelo"><input className="input" value={f.model} onChange={set('model')} /></Field>
        <Field label={f.driver === 'simulator' ? 'IP (opcional)' : 'IP *'}><input className="input" value={f.ip} onChange={set('ip')} placeholder="192.168.1.201" /></Field>
        <Field label="Puerto"><input type="number" className="input" value={f.port} onChange={set('port')} /></Field>
        <div className="border-t border-slate-200 pt-4 dark:border-slate-800 sm:col-span-2"><h3 className="text-sm font-semibold">Configuración del driver</h3></div>
        <DriverConfig driver={f.driver} config={f.config} onChange={(config) => setF({ ...f, config })} />
      </form>
    </Modal>
  );
}

function DeviceUsers({ device, onClose }) {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.get(`/devices/${device.id}/users`).then(setUsers).catch((e) => setError(e.message)); }, [device.id]);
  return (
    <Modal open onClose={onClose} title={`Usuarios en ${device.name}`}>
      {error ? <p className="p-5 text-sm text-red-600">{error}</p> : !users ? <Loading /> : users.length === 0 ? <Empty text="El equipo no tiene usuarios" /> : (
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-800/50"><tr><th className="th">ID</th><th className="th">Nombre</th><th className="th">Tarjeta</th><th className="th">PIN</th></tr></thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {users.map((u) => <tr key={u.userId}><td className="td font-mono">{u.userId}</td><td className="td">{u.name}</td><td className="td font-mono text-xs">{u.cardNumber || '—'}</td><td className="td">{u.has_pin ? 'Sí' : '—'}</td></tr>)}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

export default function Devices() {
  const { can } = useAuth();
  const confirm = useConfirm();
  const [devices, setDevices] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [viewUsers, setViewUsers] = useState(null);
  const [busy, setBusy] = useState({}); // { [id]: 'test' | 'sync' | 'import' }

  const load = () => api.get('/devices').then(setDevices).catch((e) => toast.error(e.message));
  useEffect(() => { load(); api.get('/devices/drivers').then(setDrivers).catch(() => {}); }, []);
  useRealtime((m) => {
    if (m.type === 'device_status') setDevices((list) => list?.map((d) => (d.id === m.data.id ? { ...d, status: m.data.status, last_seen: m.data.status === 'online' ? m.data.ts : d.last_seen } : d)));
  });

  const run = async (d, action) => {
    setBusy((b) => ({ ...b, [d.id]: action }));
    try {
      if (action === 'test') {
        const r = await api.post(`/devices/${d.id}/test`);
        r.ok ? toast.success(`${d.name}: conexión OK (${r.latencyMs} ms)`) : toast.error(`${d.name}: ${r.error}`);
      } else if (action === 'sync') {
        const r = await api.post(`/devices/${d.id}/sync`);
        toast.success(`Sincronizados ${r.total} usuarios (${r.added} nuevos, ${r.updated} actualizados, ${r.removed} eliminados)`);
      } else if (action === 'import') {
        const r = await api.post(`/devices/${d.id}/import-logs`);
        toast.success(`${r.imported} marcaciones importadas de ${r.total}`);
      }
      load();
    } catch (e) { toast.error(e.message); load(); } finally { setBusy((b) => ({ ...b, [d.id]: null })); }
  };

  const remove = async (d) => {
    if (!(await confirm({ title: 'Eliminar dispositivo', message: `Se eliminará "${d.name}". Las puertas asociadas quedarán sin dispositivo.` }))) return;
    try { await api.del(`/devices/${d.id}`); toast.success('Dispositivo eliminado'); load(); } catch (e) { toast.error(e.message); }
  };

  const cap = (d) => drivers.find((x) => x.id === d.driver)?.capabilities || {};

  return (
    <>
      <PageHeader title="Dispositivos" subtitle="Lectores biométricos, de tarjetas y relés de apertura"
        actions={can.write && <button className="btn-primary" onClick={() => setEditing('new')}><Plus size={16} /> Nuevo dispositivo</button>} />
      {!devices ? <Loading /> : devices.length === 0 ? <div className="card"><Empty text="No hay dispositivos" icon={Cpu} /></div> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {devices.map((d) => {
            const online = d.status === 'online';
            const b = busy[d.id];
            return (
              <div key={d.id} className="card p-5">
                <div className="flex items-start gap-3">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${online ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400'}`}>
                    {online ? <Wifi size={22} /> : <WifiOff size={22} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-semibold">{d.name}</h3>
                      <Badge color={online ? 'green' : 'red'}>{online ? 'Online' : 'Offline'}</Badge>
                    </div>
                    <p className="text-xs text-slate-500">{[d.brand, d.model].filter(Boolean).join(' ') || 'Sin marca/modelo'}</p>
                  </div>
                  {can.write && (
                    <div className="flex shrink-0">
                      <button className="btn-ghost p-2" onClick={() => setEditing(d)} title="Editar"><Pencil size={16} /></button>
                      <button className="btn-ghost p-2 text-red-600" onClick={() => remove(d)} title="Eliminar"><Trash2 size={16} /></button>
                    </div>
                  )}
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="text-slate-500">Driver</dt><dd className="text-right"><Badge color={d.driver === 'simulator' ? 'purple' : 'blue'}>{d.driver}</Badge></dd>
                  <dt className="text-slate-500">Dirección</dt><dd className="truncate text-right font-mono text-xs">{d.ip ? `${d.ip}${d.port ? `:${d.port}` : ''}` : '—'}</dd>
                  <dt className="text-slate-500">Puertas</dt><dd className="truncate text-right">{d.door_names || '—'}</dd>
                  <dt className="text-slate-500">Última conexión</dt><dd className="text-right text-xs">{fmtDateTime(d.last_seen)}</dd>
                  <dt className="text-slate-500">Última sincronización</dt><dd className="text-right text-xs">{fmtDateTime(d.last_sync)}</dd>
                </dl>
                {can.write && (
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <button className="btn-secondary" disabled={!!b} onClick={() => run(d, 'test')}>{b === 'test' ? <Spinner /> : <Plug size={16} />} Probar conexión</button>
                    {cap(d).users && <button className="btn-secondary" disabled={!!b} onClick={() => run(d, 'sync')}>{b === 'sync' ? <Spinner /> : <RefreshCw size={16} />} Sincronizar usuarios</button>}
                    {cap(d).logs && <button className="btn-ghost" disabled={!!b} onClick={() => run(d, 'import')}>{b === 'import' ? <Spinner /> : <Download size={16} />} Importar marcaciones</button>}
                    {cap(d).users && <button className="btn-ghost" onClick={() => setViewUsers(d)}><Users size={16} /> Ver usuarios</button>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {editing && <DeviceForm device={editing === 'new' ? null : editing} drivers={drivers} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {viewUsers && <DeviceUsers device={viewUsers} onClose={() => setViewUsers(null)} />}
    </>
  );
}
