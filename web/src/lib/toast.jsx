import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastCtx = createContext(() => {});

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef();
  const show = useCallback((message, { action, onAction, duration = 4200 } = {}) => {
    clearTimeout(timer.current);
    setToast({ message, action, onAction, key: Date.now() });
    timer.current = setTimeout(() => setToast(null), duration);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toast-wrap" aria-live="polite">
        {toast && (
          <div className="toast" key={toast.key} role="status">
            <span className="grow">{toast.message}</span>
            {toast.action ? (
              <button type="button" className="btn sm" onClick={() => { setToast(null); toast.onAction?.(); }}>{toast.action}</button>
            ) : <span style={{ width: 12 }} />}
          </div>
        )}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
