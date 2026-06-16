import type { ReactNode } from "react";
import { pillConfig, type PillStatus } from "../config/pill";

interface PillProps {
  status?: PillStatus;
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
  const config = status ? pillConfig[status] : null;
  const displayLabel = label ?? config?.label;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 min-h-7 text-[11px] font-semibold ${
        config ? `${config.bg} ${config.border} ${config.text}` : "border-yellow-300 bg-yellow-100 text-yellow-700"
      } ${className}`}
    >
      {count != null ? <span>{count}</span> : null}
      {displayLabel ? <span>{displayLabel}</span> : null}
      {icon}
    </span>
  );
};
