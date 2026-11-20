import { useEffect, useRef, useState } from 'react';
import { DoorOpen, CheckCircle2, XCircle, Delete } from 'lucide-react';
import { Modal, Spinner } from './ui.jsx';

/**
 * Flujo de apertura: el token de un solo uso (30 s) ya fue emitido por el servidor.
 * El usuario ingresa su PIN de 6 dígitos y se envía token + PIN.
 */
export default function OpenDoorModal({ door, tokenInfo, requirePin = true, onOpen, onClose }) {
  const [pin, setPin] = useState('');
  const [left, setLeft] = useState(tokenInfo.expiresIn);
  const [state, setState] = useState('idle'); // idle | busy | ok | error
  const [msg, setMsg] = useState('');
  const started = useRef(Date.now());

  useEffect(() => {
    const t = setInterval(() => {
      const remaining = Math.max(0, tokenInfo.expiresIn - Math.floor((Date.now() - started.current) / 1000));
      setLeft(remaining);
      if (remaining === 0) clearInterval(t);
    }, 250);
    return () => clearInterval(t);
  }, [tokenInfo]);

  const submit = async (value = pin) => {
    if (state === 'busy') return;
    setState('busy');
    try {
      const r = await onOpen(tokenInfo.token, value);
      setMsg(r.message || 'Puerta abierta');
      setState('ok');
      if (navigator.vibrate) navigator.vibrate(120);
      setTimeout(onClose, 2200);
    } catch (e) {
      setMsg(e.message);
      setState('error');
    }
  };

  const press = (d) => {
    if (state !== 'idle' || pin.length >= 6) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 6) submit(next);
  };

  useEffect(() => {
    if (!requirePin || state !== 'idle') return;
    const onKey = (e) => {
      if (/^\d$/.test(e.key)) press(e.key);
      if (e.key === 'Backspace') setPin((p) => p.slice(0, -1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const expired = left === 0 && state === 'idle';
  const pct = (left / tokenInfo.expiresIn) * 100;

  return (
    <Modal open onClose={onClose} size="sm">
      <div className="p-6 text-center">
        {state === 'ok' ? (
          <div className="py-6">
            <CheckCircle2 size={64} className="mx-auto text-emerald-500" />
            <h3 className="mt-4 text-lg font-semibold">¡Puerta abierta!</h3>
            <p className="mt-1 text-sm text-slate-500">{msg}</p>
          </div>
        ) : state === 'error' ? (
          <div className="py-6">
            <XCircle size={64} className="mx-auto text-red-500" />
            <h3 className="mt-4 text-lg font-semibold">No se pudo abrir</h3>
            <p className="mt-1 text-sm text-slate-500">{msg}</p>
            <button className="btn-secondary mt-6 w-full" onClick={onClose}>Cerrar</button>
          </div>
        ) : (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-500/15"><DoorOpen size={28} /></div>
            <h3 className="mt-3 text-lg font-semibold">{door.name}</h3>
            <div className="mx-auto mt-3 h-1.5 w-40 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div className={`h-full transition-all ${left <= 10 ? 'bg-red-500' : 'bg-blue-600'}`} style={{ width: `${pct}%` }} />
            </div>
            <p className={`mt-1 text-xs ${left <= 10 ? 'text-red-500' : 'text-slate-500'}`}>{expired ? 'El token expiró' : `Token válido por ${left} s`}</p>

            {expired ? (
              <button className="btn-secondary mt-6 w-full" onClick={onClose}>Cerrar e intentar de nuevo</button>
            ) : requirePin ? (
              <>
                <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">Ingrese su PIN de 6 dígitos</p>
                <div className="my-4 flex justify-center gap-2.5">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <span key={i} className={`h-3.5 w-3.5 rounded-full transition ${i < pin.length ? 'bg-blue-600 scale-110' : 'bg-slate-200 dark:bg-slate-700'}`} />
                  ))}
                </div>
                <div className="mx-auto grid max-w-[260px] grid-cols-3 gap-2.5">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                    <button key={d} onClick={() => press(d)} className="h-14 rounded-xl bg-slate-100 text-xl font-semibold active:scale-95 active:bg-slate-200 dark:bg-slate-800 dark:active:bg-slate-700">{d}</button>
                  ))}
                  <button onClick={onClose} className="h-14 rounded-xl text-sm text-slate-500">Cancelar</button>
                  <button onClick={() => press('0')} className="h-14 rounded-xl bg-slate-100 text-xl font-semibold active:scale-95 dark:bg-slate-800">0</button>
                  <button onClick={() => setPin(pin.slice(0, -1))} className="flex h-14 items-center justify-center rounded-xl text-slate-500" aria-label="Borrar"><Delete size={22} /></button>
                </div>
                {state === 'busy' && <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-500"><Spinner /> Abriendo…</div>}
              </>
            ) : (
              <div className="mt-6 flex gap-2">
                <button className="btn-secondary flex-1" onClick={onClose}>Cancelar</button>
                <button className="btn-primary flex-1" onClick={() => submit('')} disabled={state === 'busy'}>{state === 'busy' && <Spinner />} Abrir ahora</button>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
