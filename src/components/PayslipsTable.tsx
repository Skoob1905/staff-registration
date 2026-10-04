import { useState } from "react";
import { Download } from "lucide-react";
import { ActionButton } from "./ui";
import { Pill } from "./Pill";
import { useAuth } from "../context/AuthProvider";
import { formatSentDate } from "../utils/date";
import type { Payslip } from "../types/domain";

interface PayslipsTableProps {
  payslips: Payslip[];
  onDelete?: (payslip: Payslip) => void;
}

/**
 * Shared payslips table used on every payslips view (admin/client/worker) so
 * the columns and styling stay consistent. Renders `#`, `Payslip`, `Sent On`
 * and `Actions` rows.
 */
export const PayslipsTable = ({ payslips, onDelete }: PayslipsTableProps) => {
  const { appUser } = useAuth();
  const isWorker = appUser?.role === "worker";
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());

  const handleDownload = (payslip: Payslip) => {
    window.open(payslip.fileUrl, "_blank", "noopener,noreferrer");
    setDownloadedIds((prev) => new Set(prev).add(payslip.id));
  };

  return (
    <div className="w-full min-w-0">
      <div className="flex w-full min-w-0 items-center gap-3 border-b border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--muted-foreground)] sm:px-4">
        <span className="w-8 shrink-0">#</span>
        <span className="min-w-0 flex-1">Payslip</span>
        <span className="min-w-0 flex-1">Sent On</span>
        <span className="w-20 shrink-0 text-right">Actions</span>
      </div>
      {payslips.map((payslip, idx) => {
        const isDownloaded =
          !!payslip.hasDownloaded || downloadedIds.has(payslip.id);

        return (
          <div
            key={payslip.id}
            className="flex w-full min-w-0 items-center gap-3 border-b border-[var(--border)] px-3 py-2 last:border-0 sm:px-4"
          >
            <span className="w-8 shrink-0 tabular-nums text-xs text-[var(--muted-foreground)]">
              {idx + 1}
            </span>
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span className="min-w-0 truncate text-sm">
                {payslip.fileName}
              </span>
              {isDownloaded && !isWorker && (
                <Pill
                  status="payslip"
                  icon={<Download className="h-3.5 w-3.5" />}
                />
              )}
            </span>
            <span className="min-w-0 flex-1 text-xs text-[var(--muted-foreground)] sm:text-sm">
              {formatSentDate(payslip.timestamp)}
            </span>
            <span className="flex w-20 shrink-0 items-center justify-end gap-2">
              <ActionButton
                variant="download"
                ariaLabel="Download payslip"
                onClick={() => handleDownload(payslip)}
              />
              {onDelete && (
                <ActionButton
                  variant="delete"
                  ariaLabel="Delete payslip"
                  onClick={() => onDelete(payslip)}
                />
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
};
