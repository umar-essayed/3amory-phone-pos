import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle, HelpCircle, X } from 'lucide-react';

interface DialogOptions {
  title?: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error' | 'confirm' | 'prompt';
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  defaultValue?: string;
  placeholder?: string;
}

interface ToastItem {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

interface ModalContextType {
  showAlert: (message: string, title?: string, type?: 'info' | 'success' | 'warning' | 'error') => Promise<void>;
  showConfirm: (message: string, title?: string, options?: { confirmText?: string; cancelText?: string; danger?: boolean }) => Promise<boolean>;
  showPrompt: (message: string, defaultValue?: string, title?: string, placeholder?: string) => Promise<string | null>;
  showToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

const ModalContext = createContext<ModalContextType | null>(null);

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dialog, setDialog] = useState<DialogOptions | null>(null);
  const [promptValue, setPromptValue] = useState('');
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const resolverRef = useRef<((value: any) => void) | null>(null);

  const showToast = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'success') => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const showAlert = useCallback((message: string, title = 'تنبيه', type: 'info' | 'success' | 'warning' | 'error' = 'info'): Promise<void> => {
    return new Promise((resolve) => {
      resolverRef.current = () => {
        setDialog(null);
        resolve();
      };
      setDialog({
        title,
        message,
        type,
        confirmText: 'حسناً',
      });
    });
  }, []);

  const showConfirm = useCallback((
    message: string,
    title = 'تأكيد الإجراء',
    options?: { confirmText?: string; cancelText?: string; danger?: boolean }
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      resolverRef.current = (res: boolean) => {
        setDialog(null);
        resolve(res);
      };
      setDialog({
        title,
        message,
        type: 'confirm',
        confirmText: options?.confirmText || 'تأكيد',
        cancelText: options?.cancelText || 'إلغاء',
        danger: options?.danger ?? false,
      });
    });
  }, []);

  const showPrompt = useCallback((
    message: string,
    defaultValue = '',
    title = 'إدخال بيانات',
    placeholder = ''
  ): Promise<string | null> => {
    setPromptValue(defaultValue);
    return new Promise((resolve) => {
      resolverRef.current = (val: string | null) => {
        setDialog(null);
        resolve(val);
      };
      setDialog({
        title,
        message,
        type: 'prompt',
        defaultValue,
        placeholder,
        confirmText: 'موافق',
        cancelText: 'إلغاء',
      });
    });
  }, []);

  const handleConfirm = () => {
    if (resolverRef.current) {
      if (dialog?.type === 'prompt') {
        resolverRef.current(promptValue);
      } else {
        resolverRef.current(true);
      }
    }
  };

  const handleCancel = () => {
    if (resolverRef.current) {
      if (dialog?.type === 'prompt') {
        resolverRef.current(null);
      } else {
        resolverRef.current(false);
      }
    }
  };

  const getIcon = () => {
    switch (dialog?.type) {
      case 'success':
        return <CheckCircle2 className="h-8 w-8 text-emerald-500" />;
      case 'warning':
        return <AlertTriangle className="h-8 w-8 text-amber-500" />;
      case 'error':
        return <XCircle className="h-8 w-8 text-red-500" />;
      case 'confirm':
        return dialog.danger ? (
          <AlertTriangle className="h-8 w-8 text-red-500" />
        ) : (
          <HelpCircle className="h-8 w-8 text-blue-500" />
        );
      case 'prompt':
        return <HelpCircle className="h-8 w-8 text-indigo-500" />;
      default:
        return <Info className="h-8 w-8 text-blue-500" />;
    }
  };

  return (
    <ModalContext.Provider value={{ showAlert, showConfirm, showPrompt, showToast }}>
      {children}

      {/* Floating Toast Notifications */}
      <div className="fixed top-5 left-5 z-[100] flex flex-col gap-2 pointer-events-none max-w-sm w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 p-4 rounded-2xl shadow-xl text-white font-bold text-xs backdrop-blur-md transition-all duration-300 animate-slide-down ${
              toast.type === 'success'
                ? 'bg-emerald-600/95 border border-emerald-400/30'
                : toast.type === 'error'
                ? 'bg-red-600/95 border border-red-400/30'
                : toast.type === 'warning'
                ? 'bg-amber-600/95 border border-amber-400/30'
                : 'bg-blue-600/95 border border-blue-400/30'
            }`}
          >
            <span>{toast.message}</span>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="opacity-70 hover:opacity-100 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Custom Modal Dialog */}
      {dialog && (
        <div className="fixed inset-0 z-[99] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden transform animate-scale-in">
            <div className="p-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 border border-slate-100 shadow-inner">
                {getIcon()}
              </div>

              {dialog.title && (
                <h3 className="font-display text-lg font-bold text-slate-900 mb-2">
                  {dialog.title}
                </h3>
              )}

              <p className="text-sm font-semibold text-slate-600 leading-relaxed whitespace-pre-line mb-6">
                {dialog.message}
              </p>

              {dialog.type === 'prompt' && (
                <div className="mb-6">
                  <input
                    type="text"
                    value={promptValue}
                    onChange={(e) => setPromptValue(e.target.value)}
                    placeholder={dialog.placeholder || ''}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleConfirm();
                      if (e.key === 'Escape') handleCancel();
                    }}
                    className="w-full rounded-xl border-2 border-indigo-200 bg-slate-50 p-3 text-sm font-bold text-slate-900 text-center focus:border-indigo-500 focus:bg-white focus:outline-none transition"
                  />
                </div>
              )}

              <div className="flex items-center gap-3">
                {dialog.type === 'confirm' || dialog.type === 'prompt' ? (
                  <>
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="flex-1 rounded-xl border border-slate-200 bg-slate-50 py-3 text-xs font-bold text-slate-600 hover:bg-slate-100 active:scale-95 transition cursor-pointer"
                    >
                      {dialog.cancelText || 'إلغاء'}
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirm}
                      className={`flex-1 rounded-xl py-3 text-xs font-bold text-white active:scale-95 transition shadow-md cursor-pointer ${
                        dialog.danger
                          ? 'bg-red-600 hover:bg-red-700'
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      {dialog.confirmText || 'تأكيد'}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleConfirm}
                    className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 py-3 text-xs font-bold text-white shadow-md active:scale-95 transition cursor-pointer"
                  >
                    {dialog.confirmText || 'حسناً'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
};

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};
