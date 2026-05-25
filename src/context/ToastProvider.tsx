import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { ToastItem, ToastProviderRoot, ToastRegion, ToastViewport } from "../components/ui/toast";
import type { AppToast } from "../components/ui/toast";

type ToastInput = Omit<AppToast, "id">;

interface ToastContextValue {
  toast: (input: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<AppToast[]>([]);

  const toast = useCallback((input: ToastInput) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, ...input }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 10000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      <ToastProviderRoot>
        {children}
        <ToastRegion>
          {toasts.map((item) => (
            <ToastItem key={item.id} toast={item} onOpenChange={(open) => !open && removeToast(item.id)} />
          ))}
          <ToastViewport />
        </ToastRegion>
      </ToastProviderRoot>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
};
