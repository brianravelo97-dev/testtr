import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Fingerprint, CreditCard, Hash, Globe, Camera, X, Filter } from 'lucide-react';
import { api, qs } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useConfirm } from '../context/ConfirmContext.jsx';
import { formatRut, isValidRut, fmtDate, today } from '../lib/format.js';
import { PageHeader, Modal, Field, Toggle, SearchInput, Pagination, Loading, Empty, Badge, Avatar, Spinner, useDebounced } from '../components/ui.jsx';

const EMPTY = {
  name: '', rut: '', position: '', area: '', email: '', phone: '', status: 'active', valid_from: today(), valid_to: '',
  fingerprint_id: '', card_number: '', pin: '', clear_pin: false, web_access: false, web_password: '', group_ids: [],
};

function PersonForm({ person, groups, areas, onClose, onSaved }) {
  const [f, setF] = useState(() => person ? {
    ...EMPTY, ...Object.fromEntries(Object.entries(person).map(([k, v]) => [k, v ?? ''])),
    rut: formatRut(person.rut), pin: '', web_password: '', group_ids: person.groups.map((g) => g.id),
  } : EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState(person?.photo || null);
  const [photoFile, setPhotoFile] = useState(null);
  const fileRef = useRef();
  const set = (k) => (e) => setF({ ...f, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e });

  const validate = () => {
    const e = {};
    if (f.name.trim().length < 2) e.name = 'Ingrese el nombre';
    if (!isValidRut(f.rut)) e.rut = 'RUT inválido';
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) e.email = 'Email inválido';
    if (f.pin && !/^\d{6}$/.test(f.pin)) e.pin = 'Debe tener 6 dígitos';
    if (f.card_number && !/^\d+$/.test(f.card_number)) e.card_number = 'Sólo números';
    if (f.valid_from && f.valid_to && f.valid_to < f.valid_from) e.valid_to = 'Debe ser posterior al inicio';
    if (f.web_access && !f.web_password && !person?.has_web_password) e.web_password = 'Requerida para habilitar acceso web';
    if (f.web_password && f.web_password.length < 8) e.web_password = 'Mínimo 8 caracteres';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    try {
      const body = {
        name: f.name, rut: f.rut, position: f.position, area: f.area, email: f.email, phone: f.phone, status: f.status,
        valid_from: f.valid_from, valid_to: f.valid_to, fingerprint_id: f.fingerprint_id === '' ? null : Number(f.fingerprint_id),
        card_number: f.card_number, pin: f.pin, clear_pin: f.clear_pin, web_access: f.web_access, web_password: f.web_password, group_ids: f.group_ids,
      };
      const saved = person ? await api.put(`/people/${person.id}`, body) : await api.post('/people', body);
      if (photoFile) {
        const form = new FormData();
        form.append('photo', photoFile);
        await api.upload(`/people/${saved.id}/photo`, form);
      } else if (person?.photo && !photo) {
        await api.del(`/people/${saved.id}/photo`);
      }
      toast.success(person ? 'Persona actualizada' : 'Persona creada');
      onSaved();
    } catch (err) {
      toast.error(err.message);
      if (err.details?.[0]?.field) setErrors({ [err.details[0].field]: err.details[0].message });
    } finally { setBusy(false); }
  };

  const pickPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error('La imagen supera 2 MB');
    setPhotoFile(file);
    setPhoto(URL.createObjectURL(file));
  };

  return (
    <Modal open onClose={onClose} title={person ? 'Editar persona' : 'Nueva persona'} size="lg"
      footer={<><button className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" onClick={submit} disabled={busy}>{busy && <Spinner />} Guardar</button></>}>
      <form onSubmit={submit} className="space-y-6 p-5">
        <section className="flex flex-col gap-5 sm:flex-row">
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <Avatar name={f.name} photo={photo} size={96} />
              {photo && <button type="button" onClick={() => { setPhoto(null); setPhotoFile(null); }} className="absolute -right-1 -top-1 border border-neutral-300 bg-white p-0.5 text-neutral-600 hover:text-red-700 dark:border-neutral-600 dark:bg-neutral-900" aria-label="Quitar foto"><X size={12} /></button>}
            </div>
            <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => fileRef.current.click()}><Camera size={14} /> Foto</button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pickPhoto} />
          </div>
          <div className="grid flex-1 gap-4 sm:grid-cols-2">
            <Field label="Nombre completo *" error={errors.name} className="sm:col-span-2"><input className="input" value={f.name} onChange={set('name')} /></Field>
            <Field label="RUT *" error={errors.rut}><input className="input" placeholder="12.345.678-9" value={f.rut} onChange={(e) => setF({ ...f, rut: formatRut(e.target.value) })} maxLength={12} /></Field>
            <Field label="Estado">
              <select className="input" value={f.status} onChange={set('status')}><option value="active">Activo</option><option value="suspended">Suspendido</option></select>
            </Field>
            <Field label="Cargo"><input className="input" value={f.position} onChange={set('position')} /></Field>
            <Field label="Área">
              <input className="input" list="areas" value={f.area} onChange={set('area')} />
              <datalist id="areas">{areas.map((a) => <option key={a} value={a} />)}</datalist>
            </Field>
            <Field label="Email" error={errors.email}><input className="input" type="email" value={f.email} onChange={set('email')} /></Field>
            <Field label="Teléfono"><input className="input" placeholder="+56 9 1234 5678" value={f.phone} onChange={set('phone')} /></Field>
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold">Vigencia del acceso</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fecha de inicio"><input type="date" className="input" value={f.valid_from} onChange={set('valid_from')} /></Field>
            <Field label="Fecha de término" error={errors.valid_to} hint="Vacío = indefinido"><input type="date" className="input" value={f.valid_to} onChange={set('valid_to')} /></Field>
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold">Credenciales</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="ID de huella (N° en lector)" error={errors.fingerprint_id} hint="Sólo el ID; no se guardan huellas">
              <input className="input" type="number" min="1" max="65534" value={f.fingerprint_id} onChange={set('fingerprint_id')} />
            </Field>
            <Field label="N° tarjeta NFC/RFID" error={errors.card_number}><input className="input" inputMode="numeric" value={f.card_number} onChange={set('card_number')} /></Field>
            <Field label={person?.has_pin ? 'PIN (dejar vacío = sin cambios)' : 'PIN (6 dígitos)'} error={errors.pin}>
              <input className="input" type="password" inputMode="numeric" maxLength={6} autoComplete="new-password" value={f.pin} disabled={f.clear_pin}
                placeholder={person?.has_pin ? '••••••' : ''} onChange={(e) => setF({ ...f, pin: e.target.value.replace(/\D/g, '') })} />
            </Field>
          </div>
          {person?.has_pin && <label className="mt-2 flex items-center gap-2 text-xs text-neutral-500"><input type="checkbox" checked={f.clear_pin} onChange={set('clear_pin')} /> Eliminar PIN actual</label>}
          <div className="mt-4 rounded-xs border border-neutral-200 p-4 dark:border-neutral-800">
            <Toggle checked={f.web_access} onChange={set('web_access')} label="Acceso web (apertura remota desde el celular)" />
            {f.web_access && (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <Field label={person?.has_web_password ? 'Nueva contraseña web (opcional)' : 'Contraseña web *'} error={errors.web_password} hint="Inicia sesión con su RUT y esta contraseña">
                  <input className="input" type="password" autoComplete="new-password" value={f.web_password} onChange={set('web_password')} />
                </Field>
                <p className="self-center text-xs text-neutral-500">Para abrir puertas también necesita un PIN de 6 dígitos y pertenecer a un grupo con la puerta y horario vigente.</p>
              </div>
            )}
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold">Grupos de acceso</h3>
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => {
              const on = f.group_ids.includes(g.id);
              return (
                <button type="button" key={g.id} onClick={() => setF({ ...f, group_ids: on ? f.group_ids.filter((x) => x !== g.id) : [...f.group_ids, g.id] })}
                  className={`rounded-xs border px-3 py-1.5 text-sm transition ${on ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900' : 'border-neutral-300 text-neutral-700 hover:border-neutral-500 dark:border-neutral-700 dark:text-neutral-300'}`}>
                  {g.name}
                </button>
              );
            })}
            {groups.length === 0 && <p className="text-sm text-neutral-400">No hay grupos creados.</p>}
          </div>
        </section>
      </form>
    </Modal>
  );
}

export default function People() {
  const { can } = useAuth();
  const confirm = useConfirm();
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [filters, setFilters] = useState({ status: '', area: '', group_id: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [groups, setGroups] = useState([]);
  const [areas, setAreas] = useState([]);
  const [editing, setEditing] = useState(null); // null | 'new' | person
  const [showFilters, setShowFilters] = useState(false);

  const load = () => api.get(`/people${qs({ q: dq, ...filters, page, pageSize: 10 })}`).then(setData).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, [dq, filters, page]); // eslint-disable-line
  useEffect(() => { setPage(1); }, [dq, filters]);
  useEffect(() => {
    api.get('/groups').then(setGroups).catch(() => {});
    api.get('/people/areas').then(setAreas).catch(() => {});
  }, []);

  const remove = async (p) => {
    if (!(await confirm({ title: 'Eliminar persona', message: `Se eliminará a "${p.name}" y sus credenciales. Los registros de acceso históricos se conservan.` }))) return;
    try { await api.del(`/people/${p.id}`); toast.success('Persona eliminada'); load(); } catch (e) { toast.error(e.message); }
  };

  const expired = (p) => p.valid_to && p.valid_to < today();

  return (
    <>
      <PageHeader title="Personas" subtitle="Personas que acceden a las instalaciones y sus credenciales"
        actions={can.write && <button className="btn-primary" onClick={() => setEditing('new')}><Plus size={16} /> Nueva persona</button>} />

      <div className="card">
        <div className="flex flex-col gap-3 border-b border-neutral-200 p-4 dark:border-neutral-800 md:flex-row">
          <SearchInput value={q} onChange={setQ} placeholder="Buscar por nombre, RUT, email o tarjeta…" className="flex-1" />
          <button className="btn-secondary md:hidden" onClick={() => setShowFilters(!showFilters)}><Filter size={16} /> Filtros</button>
          <div className={`grid grid-cols-1 gap-2 sm:grid-cols-3 md:flex ${showFilters ? '' : 'hidden md:flex'}`}>
            <select className="input md:w-44" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">Todos los estados</option><option value="active">Activos</option><option value="suspended">Suspendidos</option>
            </select>
            <select className="input md:w-40" value={filters.area} onChange={(e) => setFilters({ ...filters, area: e.target.value })}>
              <option value="">Todas las áreas</option>{areas.map((a) => <option key={a}>{a}</option>)}
            </select>
            <select className="input md:w-40" value={filters.group_id} onChange={(e) => setFilters({ ...filters, group_id: e.target.value })}>
              <option value="">Todos los grupos</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        </div>

        {!data ? <Loading /> : data.data.length === 0 ? <Empty text="No se encontraron personas" /> : (
          <>
            {/* Tabla escritorio */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
                <thead>
                  <tr><th className="th">Persona</th><th className="th">Cargo / Área</th><th className="th">Credenciales</th><th className="th">Grupos</th><th className="th">Vigencia</th><th className="th">Estado</th><th className="th" /></tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {data.data.map((p) => (
                    <tr key={p.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                      <td className="td">
                        <div className="flex items-center gap-3">
                          <Avatar name={p.name} photo={p.photo} />
                          <div className="min-w-0"><div className="font-medium">{p.name}</div><div className="text-xs text-neutral-500">{formatRut(p.rut)}</div></div>
                        </div>
                      </td>
                      <td className="td"><div>{p.position || '—'}</div><div className="text-xs text-neutral-500">{p.area}</div></td>
                      <td className="td">
                        <div className="flex gap-1.5 text-neutral-400">
                          <span title={p.fingerprint_id ? `Huella ID ${p.fingerprint_id}` : 'Sin huella'} className={p.fingerprint_id ? 'text-neutral-800 dark:text-neutral-200' : 'text-neutral-300 dark:text-neutral-700'}><Fingerprint size={17} /></span>
                          <span title={p.card_number ? `Tarjeta ${p.card_number}` : 'Sin tarjeta'} className={p.card_number ? 'text-neutral-800 dark:text-neutral-200' : 'text-neutral-300 dark:text-neutral-700'}><CreditCard size={17} /></span>
                          <span title={p.has_pin ? 'Con PIN' : 'Sin PIN'} className={p.has_pin ? 'text-neutral-800 dark:text-neutral-200' : 'text-neutral-300 dark:text-neutral-700'}><Hash size={17} /></span>
                          <span title={p.web_access ? 'Acceso web' : 'Sin acceso web'} className={p.web_access ? 'text-neutral-800 dark:text-neutral-200' : 'text-neutral-300 dark:text-neutral-700'}><Globe size={17} /></span>
                        </div>
                      </td>
                      <td className="td"><div className="flex flex-wrap gap-1">{p.groups.map((g) => <span key={g.id} className="border border-neutral-300 px-1.5 py-0.5 text-xs text-neutral-700 dark:border-neutral-700 dark:text-neutral-300">{g.name}</span>)}{p.groups.length === 0 && <span className="text-xs text-neutral-400">Sin grupo</span>}</div></td>
                      <td className="td whitespace-nowrap text-xs">
                        <div>{fmtDate(p.valid_from)}</div>
                        <div className={expired(p) ? 'text-red-700 dark:text-red-500' : 'text-neutral-500'}>{p.valid_to ? `→ ${fmtDate(p.valid_to)}` : '→ Indefinido'}</div>
                      </td>
                      <td className="td">{p.status === 'active' ? (expired(p) ? <Badge color="yellow">Vencido</Badge> : <Badge color="green">Activo</Badge>) : <Badge color="red">Suspendido</Badge>}</td>
                      <td className="td whitespace-nowrap text-right">
                        {can.write && <>
                          <button className="btn-ghost p-2" onClick={() => setEditing(p)} title="Editar"><Pencil size={16} /></button>
                          <button className="btn-ghost p-2 hover:text-red-700" onClick={() => remove(p)} title="Eliminar"><Trash2 size={16} /></button>
                        </>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Tarjetas móvil */}
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-800 md:hidden">
              {data.data.map((p) => (
                <li key={p.id} className="flex items-center gap-3 p-4" onClick={() => can.write && setEditing(p)}>
                  <Avatar name={p.name} photo={p.photo} size={42} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{p.name}</div>
                    <div className="truncate text-xs text-neutral-500">{formatRut(p.rut)} · {p.area || '—'}</div>
                    <div className="mt-1 flex flex-wrap gap-1">{p.groups.map((g) => <span key={g.id} className="border border-neutral-300 px-1 text-[10px] text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">{g.name}</span>)}</div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {p.status === 'active' ? (expired(p) ? <Badge color="yellow">Vencido</Badge> : <Badge color="green">Activo</Badge>) : <Badge color="red">Suspendido</Badge>}
                    {can.write && <button className="p-1 text-neutral-400 hover:text-red-700" onClick={(e) => { e.stopPropagation(); remove(p); }} aria-label="Eliminar"><Trash2 size={16} /></button>}
                  </div>
                </li>
              ))}
            </ul>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
          </>
        )}
      </div>

      {editing && <PersonForm person={editing === 'new' ? null : editing} groups={groups} areas={areas} onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load(); api.get('/people/areas').then(setAreas); }} />}
    </>
  );
}
