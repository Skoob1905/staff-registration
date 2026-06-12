import type { ReactNode } from "react";

interface MetadataProps {
  title: string;
  value: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const Metadata = ({ title, value, className, style }: MetadataProps) => (
  <span
    className={`text-[13px] sm:text-sm text-[var(--muted-foreground)] ${className ?? ""}`}
    style={style}
  >
    <span className="font-semibold">{title}:</span>
    <span className="pl-1">{value}</span>
  </span>
);
