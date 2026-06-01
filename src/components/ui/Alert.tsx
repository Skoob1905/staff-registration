import type { ReactNode } from "react";

export const Alert = ({ children }: { children: ReactNode }) => (
  <div className="rounded-xl border border-[var(--border)] bg-[var(--primary)]/[0.08] px-3 py-2 text-sm text-[var(--foreground)]">
    {children}
  </div>
);
