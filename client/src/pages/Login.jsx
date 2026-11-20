import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { KeyRound, Lock, User, Moon, Sun, Smartphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { Spinner } from '../components/ui.jsx';

export default function Login() {
  const { user, login } = useAuth();
  const { theme, toggle } = useTheme();
  const nav = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try { await login(form.username.trim(), form.password); nav('/'); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="relative flex min-h-full items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4">
      <button onClick={toggle} className="absolute right-4 top-4 rounded-lg p-2 text-slate-300 hover:bg-white/10" aria-label="Cambiar tema">
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/30"><KeyRound size={28} /></div>
          <h1 className="text-2xl font-bold text-white">Control de Acceso</h1>
          <p className="mt-1 text-sm text-slate-400">Ingrese con su cuenta de administrador</p>
        </div>
        <form onSubmit={submit} className="card space-y-4 p-6">
          <div>
            <label className="label" htmlFor="username">Usuario</label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input id="username" className="input pl-9" autoComplete="username" autoFocus value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="password">Contraseña</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input id="password" type="password" className="input pl-9" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
          </div>
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">{error}</div>}
          <button className="btn-primary w-full py-2.5" disabled={busy || !form.username || !form.password}>{busy && <Spinner />} Ingresar</button>
        </form>
        <a href="/abrir" className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-white">
          <Smartphone size={16} /> ¿Necesita abrir una puerta? Ir al portal de apertura
        </a>
      </div>
    </div>
  );
}
