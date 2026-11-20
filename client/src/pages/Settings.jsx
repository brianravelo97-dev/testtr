import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { UserCog, Users, Database, Palette, SlidersHorizontal, Plus, Pencil, Trash2, Download, Upload, Moon, Sun, KeyRound, ShieldAlert } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useConfirm } from '../context/ConfirmContext.jsx';
import { ROLES, fmtDateTime, fmtBytes } from '../lib/format.js';
import { PageHeader, Tabs, Field, Modal, Spinner, Badge, Toggle, Loading } from '../components/ui.jsx';

function Account() {
  const { user, refresh } = useAuth();
  const [pwd, setPwd] = useState({ current_password: '', new_password: '', confirm: '' });
  const [pin, setPin] = useState({ current_password: '', pin: '' });
  const [busy, setBusy] = useState(null);

  const changePwd = async (e) => {
    e.preventDefault();
    if (pwd.new_password !== pwd.confirm) return toast.error('Las contraseñas no coinciden');
    setBusy('pwd');
    try { await api.post('/auth/change-password', pwd); toast.success('Contraseña actualizada'); setPwd({ current_password: '', new_password: '', confirm: '' }); } catch (err) { toast.error(err.message); } finally { setBusy(null); }
  };
  const savePin = async (e, remove = false) => {
    e?.preventDefault();
    if (!remove && !/^\d{6}$/.test(pin.pin)) return toast.error('El PIN debe tener 6 dígitos');
    setBusy('pin');
    try { await api.post('/auth/pin', { current_password: pin.current_password, pin: remove ? null : pin.pin }); toast.success(remove ? 'PIN eliminado' : 'PIN configurado'); setPin({ current_password: '', pin: '' }); refresh(); } catch (err) { toast.error(err.message); } finally { setBusy(null); }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form onSubmit={changePwd} className="card space-y-4 p-5">
        <h2 className="font-semibold">Cambiar contraseña</h2>
        <p className="text-xs text-neutral-500">Conectado como <b>{user.username}</b> ({ROLES[user.role]})</p>
        <Field label="Contraseña actual"><input type="password" className="input" autoComplete="current-password" value={pwd.current_password} onChange={(e) => setPwd({ ...pwd, current_password: e.target.value })} /></Field>
        <Field label="Nueva contraseña" hint="Mínimo 8 caracteres, con una mayúscula y un número"><input type="password" className="input" autoComplete="new-password" value={pwd.new_password} onChange={(e) => setPwd({ ...pwd, new_password: e.target.value })} /></Field>
        <Field label="Repetir nueva contraseña"><input type="password" className="input" autoComplete="new-password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} /></Field>
        <button className="btn-primary" disabled={busy === 'pwd' || !pwd.current_password || !pwd.new_password}>{busy === 'pwd' && <Spinner />} Actualizar contraseña</button>
      </form>
      <form onSubmit={savePin} className="card space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold"><KeyRound size={18} /> PIN de apertura (2º factor)</h2>
          {user.has_pin ? <Badge color="green">Configurado</Badge> : <Badge color="yellow">Sin configurar</Badge>}
        </div>
        <p className="text-xs text-neutral-500">PIN de 6 dígitos que se solicita al abrir puertas desde la web.</p>
        <Field label="Contraseña actual (para confirmar)"><input type="password" className="input" value={pin.current_password} onChange={(e) => setPin({ ...pin, current_password: e.target.value })} /></Field>
        <Field label="Nuevo PIN"><input type="password" inputMode="numeric" maxLength={6} className="input tracking-[0.5em]" value={pin.pin} onChange={(e) => setPin({ ...pin, pin: e.target.value.replace(/\D/g, '') })} /></Field>
        <div className="flex gap-2">
          <button className="btn-primary" disabled={busy === 'pin' || !pin.current_password}>{busy === 'pin' && <Spinner />} Guardar PIN</button>
          {user.has_pin && <button type="button" className="btn-ghost hover:text-red-700" disabled={!pin.current_password} onClick={() => savePin(null, true)}>Eliminar PIN</button>}
        </div>
      </form>
    </div>
  );
}

function UserForm({ user, onClose, onSaved }) {
  const [f, setF] = useState(user ? { ...user, email: user.email || '', password: '', active: !!user.active } : { username: '', name: '', email: '', role: 'admin', password: '', active: true });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e?.preventDefault();
    setBusy(true);
    try {
      const body = { username: f.username, name: f.name, email: f.email, role: f.role, active: f.active, password: f.password };
      user ? await api.put(`/users/${user.id}`, body) : await api.post('/users', body);
      toast.success(user ? 'Usuario actualizado' : 'Usuario creado');
      onSaved();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={user ? 'Editar usuario' : 'Nuevo usuario administrador'}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" onClick={submit} disabled={busy}>{busy && <Spinner />} Guardar</button></>}>
      <form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Usuario *"><input className="input" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} autoComplete="off" /></Field>
        <Field label="Nombre *"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Email"><input type="email" className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Rol *">
          <select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>{Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </Field>
        <Field label={user ? 'Nueva contraseña (opcional)' : 'Contraseña *'} hint="Mín. 8 caracteres, una mayúscula y un número" className="sm:col-span-2">
          <input type="password" className="input" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        </Field>
        <div className="sm:col-span-2"><Toggle checked={f.active} onChange={(v) => setF({ ...f, active: v })} label="Usuario activo" /></div>
      </form>
    </Modal>
  );
}

function UsersTab() {
  const { user: me } = useAuth();
  const confirm = useConfirm();
  const [users, setUsers] = useState(null);
  const [editing, setEditing] = useState(null);
  const load = () => api.get('/users').then(setUsers).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, []);
  const remove = async (u) => {
    if (!(await confirm({ title: 'Eliminar usuario', message: `Se eliminará el usuario "${u.username}". Esta acción no se puede deshacer.` }))) return;
    try { await api.del(`/users/${u.id}`); toast.success('Usuario eliminado'); load(); } catch (e) { toast.error(e.message); }
  };
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-neutral-200 p-4 dark:border-neutral-800">
        <div><h2 className="font-semibold">Usuarios administradores</h2><p className="text-xs text-neutral-500">Super Admin: todo · Administrador: gestiona sin usuarios ni restauración · Solo lectura: consulta</p></div>
        <button className="btn-primary" onClick={() => setEditing('new')}><Plus size={16} /> Nuevo</button>
      </div>
      {!users ? <Loading /> : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="th">Usuario</th><th className="th">Rol</th><th className="th">PIN</th><th className="th">Último acceso</th><th className="th">Estado</th><th className="th" /></tr></thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="td"><div className="font-medium">{u.name}</div><div className="text-xs text-neutral-500">{u.username}{u.email ? ` · ${u.email}` : ''}</div></td>
                  <td className="td"><Badge>{ROLES[u.role]}</Badge></td>
                  <td className="td text-xs">{u.has_pin ? 'Sí' : '—'}</td>
                  <td className="td text-xs">{fmtDateTime(u.last_login)}</td>
                  <td className="td">{u.active ? <Badge color="green">Activo</Badge> : <Badge color="red">Inactivo</Badge>}</td>
                  <td className="td whitespace-nowrap text-right">
                    <button className="btn-ghost p-2" onClick={() => setEditing(u)} title="Editar"><Pencil size={16} /></button>
                    {u.id !== me.id && <button className="btn-ghost p-2 hover:text-red-700" onClick={() => remove(u)} title="Eliminar"><Trash2 size={16} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <UserForm user={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function General() {
  const { can } = useAuth();
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get('/settings').then(setS).catch(() => {}); }, []);
  if (!s) return <Loading />;
  const save = async () => {
    setBusy(true);
    try { await api.put('/settings', { company_name: s.company_name, require_admin_pin: s.require_admin_pin }); toast.success('Configuración guardada'); } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="card max-w-xl space-y-5 p-5">
      <Field label="Nombre de la empresa"><input className="input" disabled={!can.super} value={s.company_name || ''} onChange={(e) => setS({ ...s, company_name: e.target.value })} /></Field>
      <Toggle disabled={!can.super} checked={s.require_admin_pin === '1'} onChange={(v) => setS({ ...s, require_admin_pin: v ? '1' : '0' })} label="Exigir PIN a administradores para abrir puertas desde la web" />
      <p className="text-xs text-neutral-500">Las personas que usan el portal de apertura siempre deben ingresar su PIN.</p>
      {can.super ? <button className="btn-primary" onClick={save} disabled={busy}>{busy && <Spinner />} Guardar</button> : <p className="text-xs text-neutral-500">Sólo un Super Admin puede modificar esta configuración.</p>}
    </div>
  );
}

function Backup() {
  const { can, logout } = useAuth();
  const confirm = useConfirm();
  const [list, setList] = useState([]);
  const [busy, setBusy] = useState(null);
  const fileRef = useRef();
  const load = () => api.get('/backup/list').then(setList).catch(() => {});
  useEffect(() => { if (can.write) load(); }, [can.write]);

  const download = async () => {
    setBusy('down');
    try { await api.download('/backup/download', 'respaldo.db'); toast.success('Respaldo descargado'); load(); } catch (e) { toast.error(e.message); } finally { setBusy(null); }
  };
  const restore = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!(await confirm({ title: 'Restaurar respaldo', confirmText: 'Restaurar', message: `Se reemplazará TODA la información actual con el contenido de "${file.name}". Se guardará automáticamente una copia de seguridad de la base actual.` }))) return;
    setBusy('up');
    try {
      const form = new FormData();
      form.append('file', file);
      const r = await api.upload('/backup/restore', form);
      toast.success(r.message);
      setTimeout(logout, 1500);
    } catch (err) { toast.error(err.message); } finally { setBusy(null); }
  };

  if (!can.write) return <div className="card p-5 text-sm text-neutral-500">Su rol no permite gestionar respaldos.</div>;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card space-y-4 p-5">
        <h2 className="flex items-center gap-2 font-semibold"><Download size={18} /> Descargar respaldo</h2>
        <p className="text-sm text-neutral-500">Genera una copia completa y consistente de la base de datos SQLite (personas, permisos, registros y auditoría).</p>
        <button className="btn-primary" onClick={download} disabled={!!busy}>{busy === 'down' ? <Spinner /> : <Download size={16} />} Descargar respaldo (.db)</button>
      </div>
      <div className="card space-y-4 p-5">
        <h2 className="flex items-center gap-2 font-semibold"><Upload size={18} /> Restaurar respaldo</h2>
        <p className="flex gap-2 border-l-2 border-red-700 bg-red-50 p-3 text-xs text-red-900 dark:bg-red-950/40 dark:text-red-300"><ShieldAlert size={16} className="shrink-0" /> Reemplaza todos los datos actuales. Sólo Super Admin. Deberá iniciar sesión nuevamente.</p>
        <button className="btn-danger" onClick={() => fileRef.current.click()} disabled={!can.super || !!busy}>{busy === 'up' ? <Spinner /> : <Upload size={16} />} Seleccionar archivo y restaurar</button>
        <input ref={fileRef} type="file" accept=".db,.sqlite,.sqlite3" className="hidden" onChange={restore} />
      </div>
      <div className="card overflow-hidden lg:col-span-2">
        <h2 className="border-b border-neutral-200 p-4 text-sm font-semibold dark:border-neutral-800">Respaldos guardados en el servidor <span className="font-normal text-neutral-500">(server/data/backups)</span></h2>
        <ul className="divide-y divide-neutral-100 text-sm dark:divide-neutral-800">
          {list.map((b) => <li key={b.name} className="flex justify-between gap-2 px-4 py-2.5"><span className="truncate font-mono text-xs">{b.name}</span><span className="shrink-0 text-xs text-neutral-500">{fmtBytes(b.size)} · {new Date(b.date).toLocaleString('es-CL')}</span></li>)}
          {list.length === 0 && <li className="px-4 py-6 text-center text-neutral-400">Aún no hay respaldos</li>}
        </ul>
      </div>
    </div>
  );
}

function Appearance() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="grid max-w-xl grid-cols-2 gap-4">
      {[{ id: 'light', label: 'Claro', icon: Sun }, { id: 'dark', label: 'Oscuro', icon: Moon }].map((t) => (
        <button key={t.id} onClick={() => setTheme(t.id)} className={`card flex flex-col items-center gap-3 p-6 transition ${theme === t.id ? 'border-neutral-900 dark:border-neutral-100' : ''}`}>
          <t.icon size={28} /> <span className="text-sm font-medium">Modo {t.label}</span>
        </button>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState('account');
  const tabs = [
    { id: 'account', label: 'Mi cuenta', icon: UserCog },
    can.super && { id: 'users', label: 'Usuarios', icon: Users },
    { id: 'general', label: 'General', icon: SlidersHorizontal },
    { id: 'backup', label: 'Respaldo', icon: Database },
    { id: 'appearance', label: 'Apariencia', icon: Palette },
  ].filter(Boolean);
  return (
    <>
      <PageHeader title="Configuración" subtitle="Cuenta, usuarios, respaldo y preferencias" />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'account' && <Account />}
      {tab === 'users' && can.super && <UsersTab />}
      {tab === 'general' && <General />}
      {tab === 'backup' && <Backup />}
      {tab === 'appearance' && <Appearance />}
    </>
  );
}
