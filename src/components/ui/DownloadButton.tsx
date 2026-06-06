import { Download } from "lucide-react";

const sizeMap = {
  xs: "h-3.5 w-3.5",
  sm: "h-4 w-4",
  md: "h-6 w-6",
} as const;

const iconSizeMap = {
  xs: "h-2 w-2",
  sm: "h-2.5 w-2.5",
  md: "h-3.5 w-3.5",
} as const;

interface DownloadButtonProps {
  size?: keyof typeof sizeMap;
  href?: string;
  ariaLabel: string;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
}

export const DownloadButton = ({
  size = "md",
  href,
  ariaLabel,
  onClick,
  className,
}: DownloadButtonProps) => {
  const btnSize = sizeMap[size];
  const iconSize = iconSizeMap[size];

  const base = `inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/80 text-white hover:bg-[var(--primary)] shadow-[0_2px_8px_rgba(79,125,170,0.25)] transition ${btnSize} ${className ?? ""}`;

  const icon = <Download className={iconSize} />;

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        aria-label={ariaLabel}
        className={base}
      >
        {icon}
      </a>
    );
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={base}
    >
      {icon}
    </button>
  );
};
