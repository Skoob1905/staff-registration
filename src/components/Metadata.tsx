import type { ReactNode } from "react";

interface MetadataProps {
  title: string;
  value: ReactNode;
}

export const Metadata = ({ title, value }: MetadataProps) => (
  <span className="text-xs sm:text-sm text-[var(--muted-foreground)]">
    <span className="font-semibold">{title}:</span> {value}
  </span>
);
