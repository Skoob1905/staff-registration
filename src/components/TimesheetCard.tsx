import { Clock } from "lucide-react";
import { Button } from "./ui";

interface TimesheetEntry {
  uploadedBy: string;
  uploadedAt: string;
  fileName: string;
  fileUrl: string;
}

interface TimesheetCardProps {
  entry: TimesheetEntry;
  clientName: string;
  admin?: boolean;
  onDelete?: (clientName: string, fileName: string) => void;
}

export function TimesheetCard({
  entry,
  clientName,
  admin = false,
  onDelete,
}: TimesheetCardProps) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-blue-300/30 p-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] animate-cascade"
      style={{
        background: `linear-gradient(to top, rgba(59,130,246,0.06), transparent 50%),
           linear-gradient(135deg, rgba(59,130,246,0.04), transparent),
           radial-gradient(ellipse at 100% 0%, rgba(59,130,246,0.06), transparent 55%)`,
      }}
    >
      <div
        className="pointer-events-none absolute -right-20 top-1/2 h-32 w-[380px] -translate-y-1/2 rotate-[-30deg] opacity-10 blur-xl"
        style={{ background: "rgb(37, 99, 235)" }}
      />
      <Clock
        className="pointer-events-none absolute right-1/4 top-6/7 h-40 w-40 -translate-y-1/2 text-blue-600/10 rotate-[-20deg]"
        strokeWidth={1}
      />

      <div className="flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-3">
          <span className="truncate flex-1 text-base font-bold">
            {entry.fileName}
          </span>
          <span className="shrink-0 text-base font-semibold">
            {new Date(entry.uploadedAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={() =>
              window.open(entry.fileUrl, "_blank", "noopener,noreferrer")
            }
          >
            Download
          </Button>

          {admin && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(clientName, entry.fileName)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl border border-[var(--destructive)]/20 bg-[var(--destructive-400)] text-[11px] font-semibold text-white transition-all hover:bg-[var(--destructive-500)]/85 hover:shadow-[0_2px_12px_rgba(220,38,38,0.25)]"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
