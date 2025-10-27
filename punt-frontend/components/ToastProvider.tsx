"use client";
import { createContext, useCallback, useContext, useState, ReactNode } from "react";

export interface Toast {
  id: string;
  message: string;
  type?: "success" | "error" | "info";
  ttl?: number; // ms
}

interface ToastContextValue {
  addToast: (t: Omit<Toast, "id"> & { id?: string }) => string;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (t: Omit<Toast, "id"> & { id?: string }) => {
      const id = t.id || crypto.randomUUID();
      const toast: Toast = { ttl: 4000, type: "info", ...t, id };
      setToasts((prev) => [...prev, toast]);
      if (toast.ttl && toast.ttl > 0) {
        setTimeout(() => removeToast(id), toast.ttl);
      }
      return id;
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      {/* Portal area */}
      <div className="fixed bottom-4 right-4 flex flex-col gap-3 z-50 max-w-sm">
        {toasts.map((t) => {
          const tone = t.type || 'info';
          return (
            <div
              key={t.id}
              className={`relative pl-3 pr-4 py-3 rounded-lg text-xs font-medium text-white shadow-xl border border-white/10 backdrop-blur-md animate-slide-up overflow-hidden bg-gradient-to-br from-black/70 via-black/55 to-black/60`}
            >
              <span className="absolute inset-y-0 left-0 w-1 rounded-l bg-[var(--accent)]" />
              {tone === 'success' && <span className="absolute inset-y-0 left-0 w-1 rounded-l bg-gradient-to-b from-green-600 via-green-500 to-green-400" />}
              {tone === 'error' && <span className="absolute inset-y-0 left-0 w-1 rounded-l bg-[var(--accent)]/80" />}
              {t.message}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
