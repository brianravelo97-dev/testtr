import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Clock, DoorOpen, Users, X } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useConfirm } from '../context/ConfirmContext.jsx';
import { DAYS, DAY_ORDER, formatRut } from '../lib/format.js';
import { PageHeader, Modal, Field, Loading, Empty, Spinner, SearchInput } from '../components/ui.jsx';

const COLORS = [ // (color se conserva en BD por compatibilidad, ya no se muestra)
 '#3b82f6', '#f59e0b', '#8b5cf6', '#10b981', '#ef4444', '#ec4899', '#06b6d4', '#64748b'];
const PRESETS = [
  { label: 'Lun–Vie 08:00–18:00', days: [1, 2, 3, 4, 5], start_time: '08:00', end_time: '18:00' },
  { label: 'Sábado 09:00–14:00', days: [6], start_time: '09:00', end_time: '14:00' },
  { label: '24/7', days: [0, 1, 2, 3, 4, 5, 6], start_time: '00:00', end_time: '23:59' },
  { label: 'Turno noche 22:00–06:00', days: [1, 2, 3, 4, 5], start_time: '22:00', end_time: '06:00' },
];

export const daysLabel = (days) => {
  const s = [...days].sort().join(',');
  if (s === '0,1,2,3,4,5,6') return 'Todos los días';
  if (s === '1,2,3,4,5') return 'Lun a Vie';
  if (s === '1,2,3,4,5,6') return 'Lun a Sáb';
  return DAY_ORDER.filter((d) => days.includes(d)).map((d) => DAYS[d]).join(', ');
};

function GroupForm({ group, doors, people, onClose, onSaved }) {
  const [f, setF] = useState(() => group ? {
    name: group.name, description: group.description || '', color: group.color,
    schedules: group.schedules.map(({ days, start_time, end_time }) => ({ days, start_time, end_time })),
    door_ids: group.doors.map((d) => d.id), person_ids: group.people.map((p) => p.id),
  } : { name: '', description: '', color: COLORS[0], schedules: [{ ...PRESETS[0], label: undefined }], door_ids: [], person_ids: [] });
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const setSched = (i, patch) => setF({ ...f, schedules: f.schedules.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const toggle = (key, id) => setF({ ...f, [key]: f[key].includes(id) ? f[key].filter((x) => x !== id) : [...f[key], id] });
  const filtered = useMemo(() => people.filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.rut.includes(search)), [people, search]);

  const submit = async () => {
    if (f.name.trim().length < 2) return toast.error('Ingrese el nombre del grupo');
    if (f.schedules.some((s) => s.days.length === 0)) return toast.error('Cada horario debe tener al menos un día');
    setBusy(true);
    try {
      const body = { ...f, schedules: f.schedules.map(({ days, start_time, end_time }) => ({ days, start_time, end_time })) };
      group ? await api.put(`/groups/${group.id}`, body) : await api.post('/groups', body);
      toast.success(group ? 'Grupo actualizado' : 'Grupo creado');
      onSaved();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={group ? 'Editar grupo' : 'Nuevo grupo de acceso'} size="lg"
      footer={<><button className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" onClick={submit} disabled={busy}>{busy && <Spinner />} Guardar</button></>}>
      <div className="space-y-6 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre *" className="sm:col-span-2"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Descripción" className="sm:col-span-2"><input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        </div>

        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><Clock size={16} /> Horarios permitidos</h3>
            <select className="input w-auto py-1.5 text-xs" value="" onChange={(e) => { const p = PRESETS[e.target.value]; if (p) setF({ ...f, schedules: [...f.schedules, { days: p.days, start_time: p.start_time, end_time: p.end_time }] }); }}>
              <option value="">+ Agregar horario…</option>
              {PRESETS.map((p, i) => <option key={i} value={i}>{p.label}</option>)}
            </select>
          </div>
          <div className="space-y-3">
            {f.schedules.map((s, i) => (
              <div key={i} className="flex flex-col gap-3 rounded-xs border border-neutral-200 p-3 dark:border-neutral-800 sm:flex-row sm:items-center">
                <div className="flex flex-wrap gap-1">
                  {DAY_ORDER.map((d) => (
                    <button key={d} type="button" onClick={() => setSched(i, { days: s.days.includes(d) ? s.days.filter((x) => x !== d) : [...s.days, d] })}
                      className={`h-8 w-10 rounded-xs border text-xs font-medium transition ${s.days.includes(d) ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900' : 'border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300'}`}>{DAYS[d]}</button>
                  ))}
                </div>
                <div className="flex flex-1 items-center gap-2">
                  <input type="time" className="input py-1.5" value={s.start_time} onChange={(e) => setSched(i, { start_time: e.target.value })} />
                  <span className="text-neutral-400">a</span>
                  <input type="time" className="input py-1.5" value={s.end_time} onChange={(e) => setSched(i, { end_time: e.target.value })} />
                  <button type="button" className="btn-ghost p-2 hover:text-red-700" onClick={() => setF({ ...f, schedules: f.schedules.filter((_, j) => j !== i) })} aria-label="Quitar"><X size={16} /></button>
                </div>
              </div>
            ))}
            {f.schedules.length === 0 && <p className="border-l-2 border-neutral-400 bg-neutral-50 p-3 text-xs text-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-300">Sin horarios: los integrantes no podrán acceder por este grupo.</p>}
            <p className="text-xs text-neutral-400">Si la hora de término es menor que la de inicio, el rango cruza la medianoche.</p>
          </div>
        </section>

        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><DoorOpen size={16} /> Puertas</h3>
          <div className="flex flex-wrap gap-2">
            {doors.map((d) => (
              <label key={d.id} className={`flex cursor-pointer items-center gap-2 rounded-xs border px-3 py-2 text-sm ${f.door_ids.includes(d.id) ? 'border-neutral-900 bg-neutral-50 dark:border-neutral-200 dark:bg-neutral-800' : 'border-neutral-200 dark:border-neutral-700'}`}>
                <input type="checkbox" checked={f.door_ids.includes(d.id)} onChange={() => toggle('door_ids', d.id)} /> {d.name}
              </label>
            ))}
            {doors.length === 0 && <p className="text-sm text-neutral-400">No hay puertas creadas.</p>}
          </div>
        </section>

        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Users size={16} /> Personas <span className="font-normal text-neutral-500">({f.person_ids.length} seleccionadas)</span></h3>
          <SearchInput value={search} onChange={setSearch} placeholder="Filtrar personas…" className="mb-2" />
          <div className="max-h-56 divide-y divide-neutral-100 overflow-y-auto rounded-xs border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {filtered.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                <input type="checkbox" checked={f.person_ids.includes(p.id)} onChange={() => toggle('person_ids', p.id)} />
                <span className="flex-1">{p.name}</span><span className="text-xs text-neutral-400">{formatRut(p.rut)}</span>
              </label>
            ))}
          </div>
        </section>
      </div>
    </Modal>
  );
}

export default function Groups() {
  const { can } = useAuth();
  const confirm = useConfirm();
  const [groups, setGroups] = useState(null);
  const [doors, setDoors] = useState([]);
  const [people, setPeople] = useState([]);
  const [editing, setEditing] = useState(null);

  const load = () => api.get('/groups').then(setGroups).catch((e) => toast.error(e.message));
  useEffect(() => {
    load();
    api.get('/doors').then(setDoors).catch(() => {});
    api.get('/people/options').then(setPeople).catch(() => {});
  }, []);

  const remove = async (g) => {
    if (!(await confirm({ title: 'Eliminar grupo', message: `Se eliminará el grupo "${g.name}". Sus ${g.people_count} integrantes perderán los permisos otorgados por este grupo.` }))) return;
    try { await api.del(`/groups/${g.id}`); toast.success('Grupo eliminado'); load(); } catch (e) { toast.error(e.message); }
  };

  return (
    <>
      <PageHeader title="Grupos y horarios" subtitle="Defina qué personas pueden abrir qué puertas y en qué horarios"
        actions={can.write && <button className="btn-primary" onClick={() => setEditing('new')}><Plus size={16} /> Nuevo grupo</button>} />
      {!groups ? <Loading /> : groups.length === 0 ? <div className="card"><Empty text="No hay grupos creados" /></div> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => (
            <div key={g.id} className="card flex flex-col overflow-hidden">
                            <div className="flex-1 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-medium">{g.name}</h3>
                    <p className="text-xs text-neutral-500">{g.description || 'Sin descripción'}</p>
                  </div>
                  {can.write && (
                    <div className="flex shrink-0">
                      <button className="btn-ghost p-2" onClick={() => setEditing(g)} title="Editar"><Pencil size={16} /></button>
                      <button className="btn-ghost p-2 hover:text-red-700" onClick={() => remove(g)} title="Eliminar"><Trash2 size={16} /></button>
                    </div>
                  )}
                </div>
                <div className="mt-4 space-y-1.5">
                  {g.schedules.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 text-sm"><Clock size={14} className="text-neutral-400" /><span className="font-medium">{daysLabel(s.days)}</span><span className="text-neutral-500">{s.start_time}–{s.end_time}</span></div>
                  ))}
                  {g.schedules.length === 0 && <p className="text-xs text-red-700 dark:text-red-500">Sin horarios definidos</p>}
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {g.doors.map((d) => <span key={d.id} className="inline-flex items-center gap-1 border border-neutral-300 px-1.5 py-0.5 text-xs text-neutral-700 dark:border-neutral-700 dark:text-neutral-300"><DoorOpen size={12} /> {d.name}</span>)}
                </div>
              </div>
              <div className="flex items-center gap-4 border-t border-neutral-100 px-5 py-3 text-xs text-neutral-500 dark:border-neutral-800">
                <span className="flex items-center gap-1"><Users size={14} /> {g.people_count} personas</span>
                <span className="flex items-center gap-1"><DoorOpen size={14} /> {g.door_count} puertas</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {editing && <GroupForm group={editing === 'new' ? null : editing} doors={doors} people={people} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </>
  );
}
