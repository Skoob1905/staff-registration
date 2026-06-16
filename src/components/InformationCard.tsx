import { type ReactNode } from "react";
import { Clock, Download, Eye, Receipt } from "lucide-react";
import { formatSentDate } from "../utils/date";

type CardVariant = "timesheet" | "invoice";

const config: Record<
  CardVariant,
  {
    icon: typeof Clock;
    border: string;
    accentBg: string;
    glow: string;
    isNewGlow: string;
  }
> = {
  timesheet: {
    icon: Clock,
    border: "border-blue-300/30",
    accentBg: "rgb(37, 99, 235)",
    glow: `linear-gradient(to top, rgba(59,130,246,0.06), transparent 50%),
           linear-gradient(135deg, rgba(59,130,246,0.04), transparent),
           radial-gradient(ellipse at 100% 0%, rgba(59,130,246,0.06), transparent 55%)`,
    isNewGlow: `radial-gradient(ellipse at 0% 0%, rgba(250,204,21,0.20) 0%, rgba(250,204,21,0.08) 50%, transparent 70%),
                linear-gradient(to top, rgba(59,130,246,0.06), transparent 50%),
                linear-gradient(135deg, rgba(59,130,246,0.04), transparent)`,
  },
  invoice: {
    icon: Receipt,
    border: "border-[var(--primary)]/15",
    accentBg: "var(--accent)",
    glow: `linear-gradient(to top, rgba(20,184,166,0.06), transparent 50%),
           radial-gradient(ellipse at 100% 0%, rgba(20,184,166,0.06), transparent 55%),
           radial-gradient(ellipse at 0% 100%, rgba(20,184,166,0.02), transparent 45%),
           linear-gradient(135deg, rgba(20,184,166,0.04), transparent)`,
    isNewGlow: `radial-gradient(ellipse at 0% 0%, rgba(250,204,21,0.20) 0%, rgba(250,204,21,0.08) 50%, transparent 70%),
                linear-gradient(to top, rgba(20,184,166,0.06), transparent 50%),
                radial-gradient(ellipse at 100% 0%, rgba(20,184,166,0.06), transparent 55%),
                radial-gradient(ellipse at 0% 100%, rgba(20,184,166,0.02), transparent 45%),
                linear-gradient(135deg, rgba(20,184,166,0.04), transparent)`,
  },
};

interface InformationCardProps {
  variant: CardVariant;
  name: string;
  isNew: boolean;
  hasDownloaded: boolean;
  admin: boolean;
  uploadedAt: string;
  documentInfo: ReactNode;
  infoBottom?: ReactNode;
  actions: ReactNode;
  className?: string;
}

export function InformationCard({
  variant,
  name,
  isNew,
  hasDownloaded,
  admin,
  uploadedAt,
  documentInfo,
  infoBottom,
  actions,
  className = "",
}: InformationCardProps) {
  const { icon: Icon, border, accentBg, glow, isNewGlow } = config[variant];
  const showGlow =
    isNew &&
    ((variant === "timesheet" && admin) || (variant === "invoice" && !admin));
  const showDownloaded = admin && variant === "invoice" && hasDownloaded;
  const showEye = admin && variant === "invoice" && !hasDownloaded && !isNew;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border py-3 px-3 sm:py-5 sm:px-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] animate-cascade ${border} ${className}`}
      style={{
        background: showGlow ? isNewGlow : glow,
      }}
    >
      <div
        className="pointer-events-none absolute -right-20 top-1/2 h-32 w-[380px] -translate-y-1/2 rotate-[-30deg] opacity-10 blur-xl"
        style={{ background: accentBg }}
      />
      <Icon
        className="pointer-events-none absolute right-24 sm:right-16 md:right-24 top-[85%] h-28 w-28 md:h-40 md:w-40 -translate-y-1/2 text-[var(--accent)]/10 rotate-[-20deg]"
        strokeWidth={1}
      />

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="truncate text-sm sm:text-base font-bold">
              {name}
            </span>
            <span className="shrink-0 inline-flex items-center gap-1">
              {showDownloaded && (
                <Download className="h-5 w-5 text-[var(--primary)]/50" />
              )}
              {showEye && <Eye className="h-5 w-5 text-[var(--primary)]/50" />}
            </span>
          </div>
          <div className="shrink-0">{documentInfo}</div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs sm:text-sm text-[var(--muted-foreground)]">
            Sent: {formatSentDate(uploadedAt)}
          </span>
          <div className="shrink-0">{infoBottom}</div>
        </div>
        {actions}
      </div>
    </div>
  );
}
