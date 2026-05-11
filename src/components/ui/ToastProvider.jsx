import React, { useCallback, useMemo, useState } from 'react';
import { ToastContext } from './toastContext';
const TOAST_TIMEOUT = 4200;

const toastStyles = {
  success: {
    icon: 'check_circle',
    className: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-50',
    iconClassName: 'text-emerald-300',
  },
  error: {
    icon: 'error',
    className: 'border-red-400/30 bg-red-500/15 text-red-50',
    iconClassName: 'text-red-300',
  },
  info: {
    icon: 'info',
    className: 'border-sky-400/30 bg-sky-500/15 text-sky-50',
    iconClassName: 'text-sky-300',
  },
};

let nextToastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((toast) => {
    const id = nextToastId + 1;
    nextToastId = id;

    setToasts((current) => [...current.slice(-3), { id, type: 'info', ...toast }]);

    if (toast.duration !== 0) {
      window.setTimeout(() => dismissToast(id), toast.duration || TOAST_TIMEOUT);
    }

    return id;
  }, [dismissToast]);

  const value = useMemo(() => ({
    dismissToast,
    showToast,
  }), [dismissToast, showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed left-4 right-4 top-4 z-[1000] flex flex-col gap-3 sm:left-auto sm:w-[360px]"
        aria-live="polite"
        aria-relevant="additions"
      >
        {toasts.map((toast) => {
          const style = toastStyles[toast.type] || toastStyles.info;
          const role = toast.type === 'error' ? 'alert' : 'status';

          return (
            <div
              key={toast.id}
              role={role}
              className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-2xl shadow-black/30 backdrop-blur-xl ${style.className}`}
            >
              <span className={`material-symbols-outlined mt-0.5 text-xl ${style.iconClassName}`}>
                {style.icon}
              </span>
              <div className="min-w-0 flex-1">
                {toast.title ? (
                  <p className="text-sm font-bold leading-5">{toast.title}</p>
                ) : null}
                {toast.description ? (
                  <p className="mt-0.5 text-sm leading-5 text-white/75">{toast.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Đóng thông báo"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
