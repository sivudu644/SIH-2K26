import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
}

export interface ToastContextValue {
  showToast: (type: ToastType, message: string, title?: string) => void;
  addToast: (type: ToastType, message: string, title?: string) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((type: ToastType, message: string, title?: string) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 7);
    setToasts((prev) => [...prev, { id, type, message, title }]);

    setTimeout(() => {
      removeToast(id);
    }, 4500);
  }, [removeToast]);

  const addToast = showToast;
  const success = useCallback((msg: string, title?: string) => showToast('success', msg, title || 'Success'), [showToast]);
  const error = useCallback((msg: string, title?: string) => showToast('error', msg, title || 'Error'), [showToast]);
  const warning = useCallback((msg: string, title?: string) => showToast('warning', msg, title || 'Warning'), [showToast]);
  const info = useCallback((msg: string, title?: string) => showToast('info', msg, title || 'Information'), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, addToast, success, error, warning, info }}>
      {children}
      {/* Floating Toasts Viewport */}
      <div
        style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          maxWidth: '380px',
          width: '100%',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => {
          const isSuccess = t.type === 'success';
          const isError = t.type === 'error';
          const isWarning = t.type === 'warning';

          const borderColor = isSuccess
            ? 'rgba(16, 185, 129, 0.4)'
            : isError
            ? 'rgba(244, 63, 94, 0.4)'
            : isWarning
            ? 'rgba(245, 158, 11, 0.4)'
            : 'rgba(6, 182, 212, 0.4)';

          const iconColor = isSuccess
            ? '#34d399'
            : isError
            ? '#fb7185'
            : isWarning
            ? '#fbbf24'
            : '#22d3ee';

          const IconComponent = isSuccess
            ? CheckCircle2
            : isError
            ? AlertCircle
            : isWarning
            ? AlertTriangle
            : Info;

          return (
            <div
              key={t.id}
              style={{
                pointerEvents: 'auto',
                backgroundColor: 'rgba(17, 24, 39, 0.96)',
                backdropFilter: 'blur(16px)',
                border: `1px solid ${borderColor}`,
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 0 15px rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                animation: 'slideInRight 0.25s ease-out',
                color: '#fff',
              }}
            >
              <IconComponent size={20} color={iconColor} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                {t.title && (
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '2px', color: '#fff' }}>
                    {t.title}
                  </div>
                )}
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {t.message}
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-label="Dismiss notification"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
};
