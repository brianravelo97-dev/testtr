import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, DoorOpen, MapPin, Cpu, Lock, Unlock } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useConfirm } from '../context/ConfirmContext.jsx';
import { LOCK_TYPES } from '../lib/format.js';
import { PageHeader, Modal, Field, Loading, Empty, Spinner, Badge, StatusDot } from '../components/ui.jsx';
import OpenDoorModal from '../components/OpenDoorModal.jsx';

const EMPTY = { name: '', location: '', lock_type: 'fail_secure', device_id: '', relay_number: 1, open_seconds: 3 };

function DoorForm({ door, devices, onClose, onSaved }) {
  const [f, setF] = useState(door ? { ...EMPTY, ...door, location: door.location || '', device_id: door.device_id ?? '' } : EMPTY);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e?.preventDefault();
    setBusy(true);
    try {
      const body = { name: f.name, location: f.location, lock_type: f.lock_type, device_id: f.device_id === '' ? null : Number(f.device_id), relay_number: Number(f.relay_number), open_seconds: Number(f.open_seconds) };
      door ? await api.put(`/doors/${door.id}`, body) : await api.post('/doors', body);
      toast.success(door ? 'Puerta actualizada' : 'Puerta creada');
      onSaved();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={door ? 'Editar puerta' : 'Nueva puerta'}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" onClick={submit} disabled={busy}>{busy && <Spinner />} Guardar</button></>}>
      <form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Nombre *" className="sm:col-span-2"><input className="input" value={f.name} onChange={set('name')} autoFocus /></Field>
        <Field label="Ubicación" className="sm:col-span-2"><input className="input" value={f.location} onChange={set('location')} placeholder="Ej: Piso 1, hall de entrada" /></Field>
        <Field label="Tipo de chapa" className="sm:col-span-2">
          <select className="input" value={f.lock_type} onChange={set('lock_type')}>
            {Object.entries(LOCK_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Dispositivo que la controla" className="sm:col-span-2">
          <select className="input" value={f.device_id} onChange={set('device_id')}>
            <option value="">— Sin dispositivo —</option>
            {devices.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.driver})</option>)}
          </select>
        </Field>
        <Field label="N° de puerta / relé en el equipo"><input type="number" min="1" max="16" className="input" value={f.relay_number} onChange={set('relay_number')} /></Field>
        <Field label="Tiempo de apertura (segundos)"><input type="number" min="1" max="60" className="input" value={f.open_seconds} onChange={set('open_seconds')} /></Field>
      </form>
    </Modal>
  );
}

export default function Doors() {
  const { can } = useAuth();
  const confirm = useConfirm();
  const [doors, setDoors] = useState(null);
  const [devices, setDevices] = useState([]);
  const [editing, setEditing] = useState(null);
  const [opening, setOpening] = useState(null); // { door, tokenInfo }
  const [requesting, setRequesting] = useState(null);

  const load = () => api.get('/doors').then(setDoors).catch((e) => toast.error(e.message));
  useEffect(() => { load(); api.get('/devices').then(setDevices).catch(() => {}); }, []);

  const remove = async (d) => {
    if (!(await confirm({ title: 'Eliminar puerta', message: `Se eliminará la puerta "${d.name}" y se quitará de todos los grupos.` }))) return;
    try { await api.del(`/doors/${d.id}`); toast.success('Puerta eliminada'); load(); } catch (e) { toast.error(e.message); }
  };

  const startOpen = async (door) => {
    setRequesting(door.id);
    try {
      const tokenInfo = await api.post(`/doors/${door.id}/open-token`);
      setOpening({ door, tokenInfo });
    } catch (e) { toast.error(e.message); } finally { setRequesting(null); }
  };

  return (
    <>
      <PageHeader title="Puertas" subtitle="Puertas controladas y su dispositivo asociado"
        actions={can.write && <button className="btn-primary" onClick={() => setEditing('new')}><Plus size={16} /> Nueva puerta</button>} />
      {!doors ? <Loading /> : doors.length === 0 ? <div className="card"><Empty text="No hay puertas registradas" icon={DoorOpen} /></div> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {doors.map((d) => (
            <div key={d.id} className="card flex flex-col p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400"><DoorOpen size={22} /></div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold">{d.name}</h3>
                  <p className="flex items-center gap-1 truncate text-xs text-slate-500"><MapPin size={12} /> {d.location || 'Sin ubicación'}</p>
                </div>
                {can.write && (
                  <div className="flex shrink-0">
                    <button className="btn-ghost p-2" onClick={() => setEditing(d)} title="Editar"><Pencil size={16} /></button>
                    <button className="btn-ghost p-2 text-red-600" onClick={() => remove(d)} title="Eliminar"><Trash2 size={16} /></button>
                  </div>
                )}
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-slate-500">{d.lock_type === 'fail_safe' ? <Unlock size={14} /> : <Lock size={14} />} Chapa</span>
                  <Badge color={d.lock_type === 'fail_safe' ? 'yellow' : 'blue'}>{d.lock_type === 'fail_safe' ? 'Fail-safe' : 'Fail-secure'}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-slate-500"><Cpu size={14} /> Dispositivo</span>
                  {d.device_name ? <span className="flex items-center gap-2"><StatusDot online={d.device_status === 'online'} />{d.device_name} · R{d.relay_number}</span> : <span className="text-slate-400">Sin asignar</span>}
                </div>
                <div className="flex items-center justify-between"><span className="text-slate-500">Apertura</span><span>{d.open_seconds} s</span></div>
                <div className="flex items-center justify-between"><span className="text-slate-500">Grupos con acceso</span><span>{d.group_count}</span></div>
              </div>
              {can.write && (
                <button className="btn-primary mt-5 w-full" disabled={!d.device_id || requesting === d.id} onClick={() => startOpen(d)}>
                  {requesting === d.id ? <Spinner /> : <DoorOpen size={16} />} Abrir remotamente
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {editing && <DoorForm door={editing === 'new' ? null : editing} devices={devices} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {opening && <OpenDoorModal door={opening.door} tokenInfo={opening.tokenInfo} requirePin={opening.tokenInfo.requirePin}
        onOpen={(token, pin) => api.post('/doors/open', { token, pin })} onClose={() => setOpening(null)} />}
    </>
  );
}
