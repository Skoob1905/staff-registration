import type { ReactNode } from "react";

const cls = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");

export const Card = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div
    className={cls(
      "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3 shadow-[0_12px_28px_rgba(18,50,92,0.10)] sm:p-4",
      className,
    )}
  >
    {children}
  </div>
);
