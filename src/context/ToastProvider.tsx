/* eslint-disable react-refresh/only-export-components */

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { ToastItem, ToastProviderRoot, ToastRegion, ToastViewport, type AppToast } from "../components/ui";

interface ToastEntry extends AppToast {
  open: boolean;
}

type ToastInput = Omit<AppToast, "id"> & {
  id?: string;
  replaceToast?: boolean;
};

interface ToastContextValue {
  toast: (input: ToastInput) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const replacingRef = useRef(false);

  const removingRef = useRef(false);

  const toast = useCallback((input: ToastInput) => {
    const { replaceToast, id: providedId, ...toastInput } = input;
    const id = providedId ?? crypto.randomUUID();

    if (replaceToast) {
      replacingRef.current = true;
      setToasts((prev) => prev.map((t) => ({ ...t, open: false })));
      setTimeout(() => {
        replacingRef.current = false;
        setToasts([{ id, ...toastInput, open: true }]);
      }, 300);
      return;
    }

    if (providedId) {
      setToasts((prev) => {
        const exists = prev.some((t) => t.id === providedId);
        if (exists) {
          return prev.map((t) =>
            t.id === providedId ? { ...t, ...toastInput, open: true } : t,
          );
        }
        return [...prev, { id, ...toastInput, open: true }];
      });
      return;
    }

    setToasts((prev) => [...prev, { id, ...toastInput, open: true }]);
  }, []);

  const closeToast = useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, open: false } : t)),
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  const dismissToast = useCallback(
    (id: string) => {
      closeToast(id);
    },
    [closeToast],
  );

  const value = useMemo(
    () => ({ toast, dismissToast }),
    [toast, dismissToast],
  );

  const renderToast = (item: ToastEntry) => (
    <ToastItem
      key={item.id}
      toast={item}
      open={item.open}
      onOpenChange={(open) => {
        if (!open && !replacingRef.current && !removingRef.current) {
          removingRef.current = true;
          closeToast(item.id);
          setTimeout(() => {
            removingRef.current = false;
          }, 350);
        }
      }}
    />
  );

  const topToasts = toasts.filter((t) => t.position !== "bottom-right");
  const cornerToasts = toasts.filter((t) => t.position === "bottom-right");

  return (
    <ToastContext.Provider value={value}>
      <ToastProviderRoot>
        {children}
        <ToastRegion>
          {topToasts.map(renderToast)}
          <ToastViewport />
        </ToastRegion>
        {cornerToasts.length > 0 && (
          <ToastProviderRoot>
            <ToastRegion>
              {cornerToasts.map(renderToast)}
              <ToastViewport position="bottom-right" />
            </ToastRegion>
          </ToastProviderRoot>
        )}
      </ToastProviderRoot>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
};
