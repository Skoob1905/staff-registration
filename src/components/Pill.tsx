import { pillConfig, type PillStatus } from "../config/pill";

interface PillProps {
  status: PillStatus;
  className?: string;
}

export const Pill = ({ status, className = "" }: PillProps) => {
  const config = pillConfig[status];
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${config.bg} ${config.border} ${config.text} ${className}`}
    >
      {config.label}
    </span>
  );
};
