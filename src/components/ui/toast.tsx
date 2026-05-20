import * as ToastPrimitive from "@radix-ui/react-toast";
import { X } from "lucide-react";
import type { ReactNode } from "react";

type ToastVariant = "default" | "error";

export interface AppToast {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
}

export const ToastProviderRoot = ToastPrimitive.Provider;

export const ToastViewport = () => (
  <ToastPrimitive.Viewport className="fixed left-1/2 top-4 z-[9999] flex w-[420px] max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col gap-2 outline-none" />
);

export const ToastItem = ({
  toast,
  onOpenChange,
}: {
  toast: AppToast;
  onOpenChange: (open: boolean) => void;
}) => {
  const isError = toast.variant === "error";

  return (
    <ToastPrimitive.Root
      open
      onOpenChange={onOpenChange}
      duration={5000}
      className={`group z-[9999] pointer-events-auto rounded-xl border p-4 shadow-lg transition-opacity duration-300 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 ${
        isError
          ? "border-red-300 bg-red-50/90"
          : "border-emerald-300 bg-emerald-50/90"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <ToastPrimitive.Title className={`text-sm font-semibold ${isError ? "text-red-900" : "text-emerald-900"}`}>
            {toast.title}
          </ToastPrimitive.Title>
          {toast.description ? (
            <ToastPrimitive.Description className={`mt-1 text-sm ${isError ? "text-red-800" : "text-emerald-800"}`}>
              {toast.description}
            </ToastPrimitive.Description>
          ) : null}
        </div>
        <ToastPrimitive.Close className={`transition ${isError ? "text-red-700 hover:text-red-900" : "text-emerald-700 hover:text-emerald-900"}`}>
          <X className="h-4 w-4" />
        </ToastPrimitive.Close>
      </div>
    </ToastPrimitive.Root>
  );
};

export const ToastRegion = ({ children }: { children: ReactNode }) => (
  <div className="pointer-events-none fixed inset-0 z-[9999]">{children}</div>
);
