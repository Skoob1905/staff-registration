/* eslint-disable react-refresh/only-export-components */

import * as ToastPrimitive from "@radix-ui/react-toast";
import { X } from "lucide-react";
import type { ReactNode } from "react";

type ToastVariant = "default" | "success" | "error" | "info" | "warning";

export interface AppToast {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  icon?: ReactNode;
}

export const ToastProviderRoot = ToastPrimitive.Provider;

export const ToastViewport = () => (
  <ToastPrimitive.Viewport className="fixed left-1/2 top-4 z-[9999] flex w-[420px] max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col gap-2 outline-none" />
);

export const ToastItem = ({
  toast,
  open,
  onOpenChange,
}: {
  toast: AppToast;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const isError = toast.variant === "error";
  const isInfo = toast.variant === "info";

  const borderColor = isError
    ? "border-red-300 bg-red-50"
    : isInfo
      ? "border-blue-300 bg-blue-50"
      : "border-emerald-300 bg-emerald-50";

  const textColor = isError
    ? "text-red-900"
    : isInfo
      ? "text-blue-900"
      : "text-emerald-900";

  const descColor = isError
    ? "text-red-800"
    : isInfo
      ? "text-blue-800"
      : "text-emerald-800";

  const closeColor = isError
    ? "text-red-700 hover:text-red-900"
    : isInfo
      ? "text-blue-700 hover:text-blue-900"
      : "text-emerald-700 hover:text-emerald-900";

  return (
    <ToastPrimitive.Root
      open={open}
      onOpenChange={onOpenChange}
      duration={5000}
      className={`group z-[9999] pointer-events-auto rounded-xl border p-4 shadow-lg transition-opacity duration-300 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 ${borderColor}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          {toast.icon ? <span className="mt-0.5 shrink-0">{toast.icon}</span> : null}
          <div>
            <ToastPrimitive.Title className={`text-sm font-semibold ${textColor}`}>
              {toast.title}
            </ToastPrimitive.Title>
            {toast.description ? (
              <ToastPrimitive.Description className={`mt-1 text-sm ${descColor}`}>
                {toast.description}
              </ToastPrimitive.Description>
            ) : null}
          </div>
        </div>
        <ToastPrimitive.Close className={`transition ${closeColor}`}>
          <X className="h-4 w-4" />
        </ToastPrimitive.Close>
      </div>
    </ToastPrimitive.Root>
  );
};

export const ToastRegion = ({ children }: { children: ReactNode }) => (
  <div className="pointer-events-none fixed inset-0 z-[9999]">{children}</div>
);
