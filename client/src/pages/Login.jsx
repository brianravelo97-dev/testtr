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
    <div className="relative flex min-h-full items-center justify-center bg-neutral-100 p-4 dark:bg-neutral-950">
      <button onClick={toggle} className="btn-ghost absolute right-4 top-4 p-2" aria-label="Cambiar tema">
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2 text-neutral-500"><KeyRound size={18} /><span className="text-xs font-medium uppercase tracking-wider">Control de Acceso</span></div>
          <h1 className="text-xl font-semibold">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-neutral-500">Ingrese con su cuenta de administrador</p>
        </div>
        <form onSubmit={submit} className="card space-y-4 p-6">
          <div>
            <label className="label" htmlFor="username">Usuario</label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -tranneutral-y-1/2 text-neutral-400" />
              <input id="username" className="input pl-9" autoComplete="username" autoFocus value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="password">Contraseña</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -tranneutral-y-1/2 text-neutral-400" />
              <input id="password" type="password" className="input pl-9" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
          </div>
          {error && <div className="border-l-2 border-red-700 bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">{error}</div>}
          <button className="btn-primary w-full py-2.5" disabled={busy || !form.username || !form.password}>{busy && <Spinner />} Ingresar</button>
        </form>
        <a href="/abrir" className="mt-5 flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">
          <Smartphone size={16} /> Portal de apertura de puertas
        </a>
      </div>
    </div>
  );
}
