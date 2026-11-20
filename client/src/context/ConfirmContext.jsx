import { createContext, useContext, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '../components/ui.jsx';

const ConfirmCtx = createContext(null);

/** Uso: const confirm = useConfirm(); if (await confirm({ title, message })) { ... } */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolver = useRef(null);

  const confirm = (opts) => new Promise((resolve) => {
    resolver.current = resolve;
    setState({ title: '¿Está seguro?', confirmText: 'Eliminar', danger: true, ...opts });
  });
  const close = (value) => { resolver.current?.(value); setState(null); };

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal open={!!state} onClose={() => close(false)} size="sm">
        {state && (
          <div className="p-6">
            <div className="flex gap-4">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${state.danger ? 'bg-red-100 text-red-600 dark:bg-red-500/15' : 'bg-blue-100 text-blue-600 dark:bg-blue-500/15'}`}>
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-base font-semibold">{state.title}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{state.message}</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => close(false)}>Cancelar</button>
              <button autoFocus className={state.danger ? 'btn-danger' : 'btn-primary'} onClick={() => close(true)}>{state.confirmText}</button>
            </div>
          </div>
        )}
      </Modal>
    </ConfirmCtx.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmCtx);
