/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(null);

const TOAST_STYLES = {
  success: {
    border: 'border-jade-border bg-jade-soft text-foreground',
    icon: 'check_circle',
    iconColor: 'text-jade',
  },
  error: {
    border: 'border-primary/40 bg-primary-soft text-foreground',
    icon: 'error',
    iconColor: 'text-primary',
  },
  warning: {
    border: 'border-gold bg-gold-soft text-foreground',
    icon: 'warning',
    iconColor: 'text-accent',
  },
  info: {
    border: 'border-border-strong bg-surface text-foreground',
    icon: 'info',
    iconColor: 'text-primary',
  },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback(
    (message, type = 'info', duration = 3600) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { id, message, type }]);
      if (duration > 0) {
        window.setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          aria-atomic="true"
          className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[min(380px,calc(100vw-2rem))] pointer-events-none"
        >
          {toasts.map((toast) => {
            const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info;
            return (
              <div
                key={toast.id}
                role="status"
                className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3.5 py-3 shadow-md transition-all ${style.border}`}
              >
                <span
                  className={`material-symbols-outlined text-lg no-shrink mt-0.5 ${style.iconColor}`}
                  aria-hidden="true"
                >
                  {style.icon}
                </span>
                <p className="flex-1 text-xs sm:text-sm font-medium leading-relaxed text-foreground">
                  {toast.message}
                </p>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  aria-label="Đóng thông báo"
                  className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    close
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      showToast: (msg) => {
        if (typeof window !== 'undefined') console.info('[Toast]', msg);
      },
    };
  }
  return ctx;
}
