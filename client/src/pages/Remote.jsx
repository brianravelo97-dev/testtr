import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { DoorOpen, LogOut, KeyRound, Moon, Sun, Lock, RefreshCw, MapPin } from 'lucide-react';
import { api, tokens } from '../lib/api.js';
import { formatRut } from '../lib/format.js';
import { useTheme } from '../context/ThemeContext.jsx';
import { Avatar, Spinner } from '../components/ui.jsx';
import OpenDoorModal from '../components/OpenDoorModal.jsx';

const opts = () => ({ token: tokens.person });

function RemoteLogin({ onLogin }) {
  const [f, setF] = useState({ rut: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const r = await api.post('/remote/login', f, { token: null });
      tokens.person = r.token;
      onLogin(r.person);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="card mx-auto w-full max-w-sm space-y-4 p-6">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white"><KeyRound size={28} /></div>
        <h1 className="text-xl font-bold">Apertura de puertas</h1>
        <p className="text-sm text-slate-500">Ingrese con su RUT y contraseña web</p>
      </div>
      <div><label className="label">RUT</label><input className="input py-3 text-base" inputMode="text" placeholder="12.345.678-9" autoComplete="username" value={f.rut} onChange={(e) => setF({ ...f, rut: formatRut(e.target.value) })} maxLength={12} /></div>
      <div><label className="label">Contraseña</label><input className="input py-3 text-base" type="password" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">{error}</div>}
      <button className="btn-primary w-full py-3 text-base" disabled={busy || !f.rut || !f.password}>{busy && <Spinner />} Ingresar</button>
    </form>
  );
}

export default function Remote() {
  const { theme, toggle } = useTheme();
  const [person, setPerson] = useState(null);
  const [checking, setChecking] = useState(!!tokens.person);
  const [doors, setDoors] = useState(null);
  const [requesting, setRequesting] = useState(null);
  const [opening, setOpening] = useState(null);

  const logout = () => { tokens.person = null; setPerson(null); setDoors(null); };
  const loadDoors = () => api.get('/remote/doors', opts()).then(setDoors).catch((e) => { if (e.status === 401) logout(); else toast.error(e.message); });

  useEffect(() => {
    if (!tokens.person) return;
    api.get('/remote/me', opts()).then((r) => setPerson(r.person)).catch(() => logout()).finally(() => setChecking(false));
  }, []);
  useEffect(() => { if (person) { loadDoors(); const t = setInterval(loadDoors, 60000); return () => clearInterval(t); } }, [person]); // eslint-disable-line

  const start = async (door) => {
    setRequesting(door.id);
    try {
      const tokenInfo = await api.post('/remote/token', { door_id: door.id }, opts());
      setOpening({ door, tokenInfo });
    } catch (e) { toast.error(e.message); loadDoors(); } finally { setRequesting(null); }
  };

  return (
    <div className="flex min-h-full flex-col bg-gradient-to-b from-blue-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
      <header className="flex items-center justify-between px-4 py-3" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        {person ? (
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={person.name} photo={person.photo} size={40} />
            <div className="min-w-0"><div className="truncate text-sm font-semibold">{person.name}</div><div className="text-xs text-slate-500">{formatRut(person.rut)}</div></div>
          </div>
        ) : <span className="text-sm font-semibold text-slate-500">Control de Acceso</span>}
        <div className="flex shrink-0 gap-1">
          <button onClick={toggle} className="btn-ghost p-2.5" aria-label="Cambiar tema">{theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}</button>
          {person && <button onClick={logout} className="btn-ghost p-2.5" aria-label="Cerrar sesión"><LogOut size={20} /></button>}
        </div>
      </header>

      <main className="flex flex-1 flex-col px-4 pb-8">
        {checking ? <div className="flex flex-1 items-center justify-center"><Spinner /></div>
          : !person ? <div className="flex flex-1 items-center"><RemoteLogin onLogin={setPerson} /></div>
          : (
            <div className="mx-auto w-full max-w-md">
              <div className="mb-4 mt-2 flex items-center justify-between">
                <h1 className="text-lg font-bold">Mis puertas</h1>
                <button className="btn-ghost p-2" onClick={loadDoors} aria-label="Actualizar"><RefreshCw size={18} /></button>
              </div>
              {!doors ? <div className="flex justify-center py-10"><Spinner /></div> : doors.length === 0 ? (
                <div className="card p-8 text-center text-sm text-slate-500"><Lock className="mx-auto mb-3 text-slate-400" size={32} />No tiene puertas asignadas. Contacte al administrador.</div>
              ) : (
                <div className="space-y-4">
                  {doors.map((d) => (
                    <div key={d.id} className="card overflow-hidden">
                      <div className="flex items-center gap-3 px-5 pt-5">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${d.allowed ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/15' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}><DoorOpen size={22} /></div>
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{d.name}</div>
                          {d.location && <div className="flex items-center gap-1 truncate text-xs text-slate-500"><MapPin size={11} /> {d.location}</div>}
                        </div>
                      </div>
                      <div className="p-5">
                        <button onClick={() => start(d)} disabled={!d.allowed || requesting === d.id}
                          className={`flex w-full items-center justify-center gap-3 rounded-2xl py-6 text-xl font-bold shadow-lg transition active:scale-[0.98] disabled:shadow-none ${d.allowed ? 'bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-blue-600/30' : 'bg-slate-200 text-slate-400 dark:bg-slate-800'}`}>
                          {requesting === d.id ? <Spinner className="h-6 w-6" /> : d.allowed ? <DoorOpen size={28} /> : <Lock size={24} />}
                          {d.allowed ? 'Abrir' : 'No disponible'}
                        </button>
                        {!d.allowed && <p className="mt-2 text-center text-xs text-slate-500">{d.reason}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-6 text-center text-xs text-slate-400">Cada apertura usa un token de un solo uso válido por 30 segundos y requiere su PIN.</p>
            </div>
          )}
      </main>
      {opening && <OpenDoorModal door={opening.door} tokenInfo={opening.tokenInfo} requirePin
        onOpen={(token, pin) => api.post('/remote/open', { token, pin }, opts())} onClose={() => setOpening(null)} />}
    </div>
  );
}
