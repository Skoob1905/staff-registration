import { Download, X } from "lucide-react";

const cls = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");

const sizeMap = {
  xs: { btn: "h-3.5 w-3.5", icon: "h-2 w-2" },
  sm: { btn: "h-4 w-4", icon: "h-2.5 w-2.5" },
  md: { btn: "h-6 w-6", icon: "h-3.5 w-3.5" },
} as const;

type ActionButtonProps = {
  variant: "delete" | "download";
  size?: keyof typeof sizeMap;
  onClick?: (e: React.MouseEvent) => void;
  href?: string;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
};

export const ActionButton = ({
  variant,
  size = "md",
  onClick,
  href,
  ariaLabel,
  disabled,
  className,
}: ActionButtonProps) => {
  const { btn, icon } = sizeMap[size];

  const base = cls(
    "inline-flex shrink-0 items-center justify-center rounded-full transition",
    btn,
    variant === "delete"
      ? "bg-red-500/80 text-white hover:bg-red-600 shadow-[0_2px_8px_rgba(220,38,38,0.25)]"
      : "bg-[var(--primary)]/80 text-white hover:bg-[var(--primary)] shadow-[0_2px_8px_rgba(79,125,170,0.25)]",
    disabled && "cursor-not-allowed opacity-40",
    className,
  );

  const iconEl =
    variant === "delete" ? (
      <X className={icon} />
    ) : (
      <Download className={icon} />
    );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        aria-label={ariaLabel}
        className={base}
      >
        {iconEl}
      </a>
    );
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={base}
    >
      {iconEl}
    </button>
  );
};
