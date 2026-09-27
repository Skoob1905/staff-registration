import type { CSSProperties, ReactNode } from "react";

const cls = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");

export const Card = ({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) => (
  <div
    className={cls(
      "rounded-[var(--radius)] animate-border-flow bg-[var(--card)] p-3 shadow-[0_12px_28px_rgba(18,50,92,0.10)] sm:p-4",
      className,
    )}
    style={style}
  >
    {children}
  </div>
);
