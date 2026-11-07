import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ConfirmCtx = createContext(async () => false);

/**
 * Confirmação com <dialog> nativo (DESIGN.md 8.3), no lugar do confirm() do navegador.
 * Uso: const ok = await confirm({ title, message, confirmLabel, danger })
 */
export function ConfirmProvider({ children }) {
  const ref = useRef(null);
  const resolver = useRef(null);
  const [opts, setOpts] = useState(null);

  const confirm = useCallback((o) => new Promise((resolve) => {
    resolver.current = resolve;
    setOpts(o);
    requestAnimationFrame(() => ref.current?.showModal());
  }), []);

  const finish = (value) => {
    ref.current?.close();
    resolver.current?.(value);
    resolver.current = null;
    setOpts(null);
  };

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <dialog ref={ref} className="confirm-dialog" role="alertdialog" aria-labelledby="confirm-title" aria-describedby="confirm-msg" onCancel={(e) => { e.preventDefault(); finish(false); }}>
        {opts && (
          <form method="dialog" className="stack gap-16" onSubmit={(e) => { e.preventDefault(); finish(true); }}>
            <div className="stack gap-8">
              <h2 id="confirm-title" className="title t-20">{opts.title}</h2>
              {opts.message && <p id="confirm-msg" className="t-15 secondary">{opts.message}</p>}
            </div>
            <div className="stack gap-8">
              <button type="submit" className="btn btn-dark block" autoFocus style={opts.danger ? { background: 'var(--nobi-danger)', color: '#FFFFFF' } : undefined}>{opts.confirmLabel || 'Confirmar'}</button>
              <button type="button" className="btn btn-ghost block" onClick={() => finish(false)}>{opts.cancelLabel || 'Cancelar'}</button>
            </div>
          </form>
        )}
      </dialog>
    </ConfirmCtx.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmCtx);
