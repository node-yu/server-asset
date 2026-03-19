import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { X, AlertCircle, CheckCircle, Info } from 'lucide-react';

type ToastType = 'info' | 'success' | 'error';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
  error: (message: string) => void;
  success: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++toastId;
    setItems((prev) => [...prev, { id, message, type }]);
    setTimeout(() => remove(id), 4000);
  }, [remove]);

  const error = useCallback((message: string) => toast(message, 'error'), [toast]);
  const success = useCallback((message: string) => toast(message, 'success'), [toast]);

  return (
    <ToastContext.Provider value={{ toast, error, success }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        <div className="pointer-events-auto flex flex-col gap-2">
          {items.map((t) => (
            <ToastItem key={t.id} message={t.message} type={t.type} onClose={() => remove(t.id)} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ message, type, onClose }: { message: string; type: ToastType; onClose: () => void }) {
  const config = {
    info: { icon: Info, bg: 'bg-slate-800', border: 'border-slate-700' },
    success: { icon: CheckCircle, bg: 'bg-emerald-800', border: 'border-emerald-700' },
    error: { icon: AlertCircle, bg: 'bg-red-800', border: 'border-red-700' },
  }[type];
  const Icon = config.icon;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${config.bg} ${config.border} text-white min-w-[280px] max-w-[400px]`}
      role="alert"
    >
      <Icon size={20} className="shrink-0 text-white/90" />
      <p className="flex-1 text-sm font-medium">{message}</p>
      <button
        onClick={onClose}
        className="p-1 rounded hover:bg-white/20 text-white/80 hover:text-white transition-colors"
        aria-label="关闭"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      toast: (m: string) => alert(m),
      error: (m: string) => alert(m),
      success: (m: string) => alert(m),
    };
  }
  return ctx;
}
