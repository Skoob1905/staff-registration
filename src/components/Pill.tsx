import type { ReactNode } from "react";
import { pillConfig, type PillStatus } from "../config/pill";

interface PillProps {
  status?: PillStatus;
  count?: number;
  className?: string;
  label?: string;
  icon?: ReactNode;
  onClick?: () => void;
}

export const Pill = ({
  status,
  count,
  className = "",
  label,
  icon,
  onClick,
}: PillProps) => {
  const config = status ? pillConfig[status] : null;
  const displayLabel = label ?? config?.label;
  const classes = `inline-flex items-center gap-1 rounded-full border px-2 py-1 min-h-7 text-[11px] font-semibold ${
    config
      ? `${config.bg} ${config.border} ${config.text}`
      : "border-yellow-300 bg-yellow-100 text-yellow-700"
  } ${onClick ? "cursor-pointer active:scale-95 transition-transform select-none" : ""} ${className}`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className={classes}
      >
        {count != null ? <span>{count}</span> : null}
        {displayLabel ? <span>{displayLabel}</span> : null}
        {icon}
      </button>
    );
  }

  return (
    <span className={classes}>
      {count != null ? <span>{count}</span> : null}
      {displayLabel ? <span>{displayLabel}</span> : null}
      {icon}
    </span>
  );
};
