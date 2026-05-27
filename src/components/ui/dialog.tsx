import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

export const DialogRoot = Dialog.Root;
export const DialogTrigger = Dialog.Trigger;
export const DialogTitle = Dialog.Title;

export const DialogContent = ({
  children,
  onClose,
  className = "",
  closeDisabled = false,
}: {
  children: ReactNode;
  onClose: () => void;
  className?: string;
  closeDisabled?: boolean;
}) => (
  <Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 z-40 bg-black/35" />
    <Dialog.Content
      className={`fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--border)] bg-white p-5 shadow-xl ${className}`}
      onInteractOutside={(e) => {
        if (closeDisabled) e.preventDefault();
      }}
      onEscapeKeyDown={(e) => {
        if (closeDisabled) e.preventDefault();
      }}
    >
      <button
        type="button"
        disabled={closeDisabled}
        onClick={onClose}
        className="absolute right-3 top-3 rounded-md p-1 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label="Close registration modal"
      >
        <X className="h-4 w-4" />
      </button>
      {children}
    </Dialog.Content>
  </Dialog.Portal>
);
