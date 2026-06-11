import type { ReactNode } from "react";

interface MetadataProps {
  title: string;
  value: ReactNode;
  className?: string;
}

export const Metadata = ({ title, value, className }: MetadataProps) => (
  <span
    className={`text-xs sm:text-sm text-[var(--muted-foreground)] ${className ?? ""}`}
  >
    <span className="font-semibold">{title}: </span>
    <span className="pl-1">{value}</span>
  </span>
);
