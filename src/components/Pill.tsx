import type { ReactNode } from "react";
import { pillConfig, type PillStatus } from "../config/pill";

interface PillProps {
  status: PillStatus;
  count?: number;
  className?: string;
  label?: string;
  icon?: ReactNode;
}

export const Pill = ({
  status,
  count,
  className = "",
  label,
  icon,
}: PillProps) => {
  const config = pillConfig[status];
  const displayLabel = label ?? config.label;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${config.bg} ${config.border} ${config.text} ${className}`}
    >
      {count != null ? <span>{count}</span> : null}
      <span>{displayLabel}</span>
      {icon}
    </span>
  );
};
