/* eslint-disable react-refresh/only-export-components */

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { ToastItem, ToastProviderRoot, ToastRegion, ToastViewport, type AppToast } from "../components/ui";

interface ToastEntry extends AppToast {
  open: boolean;
}

type ToastInput = Omit<AppToast, "id"> & { replaceToast?: boolean };

interface ToastContextValue {
  toast: (input: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const replacingRef = useRef(false);

  const removingRef = useRef(false);

  const toast = useCallback((input: ToastInput) => {
    const { replaceToast, ...toastInput } = input;
    const id = crypto.randomUUID();

    if (replaceToast) {
      replacingRef.current = true;
      setToasts((prev) => prev.map((t) => ({ ...t, open: false })));
      setTimeout(() => {
        replacingRef.current = false;
        setToasts([{ id, ...toastInput, open: true }]);
      }, 300);
    } else {
      setToasts((prev) => [...prev, { id, ...toastInput, open: true }]);
    }
  }, []);

  const closeToast = useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, open: false } : t)),
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      <ToastProviderRoot>
        {children}
        <ToastRegion>
          {toasts.map((item) => (
            <ToastItem
              key={item.id}
              toast={item}
              open={item.open}
              onOpenChange={(open) => {
                if (!open && !replacingRef.current && !removingRef.current) {
                  removingRef.current = true;
                  closeToast(item.id);
                  setTimeout(() => { removingRef.current = false; }, 350);
                }
              }}
            />
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
