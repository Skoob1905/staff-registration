import { ActionButton, DeleteButton } from "./ui";
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
export const PayslipsTable = ({ payslips, onDelete }: PayslipsTableProps) => (
  <div className="w-full min-w-0">
    <div className="flex w-full min-w-0 items-center gap-3 border-b border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--muted-foreground)] sm:px-4">
      <span className="w-8 shrink-0">#</span>
      <span className="min-w-0 flex-1">Payslip</span>
      <span className="min-w-0 flex-1">Sent On</span>
      <span className="w-20 shrink-0 text-right">Actions</span>
    </div>
    {payslips.map((payslip, idx) => (
      <div
        key={payslip.id}
        className="flex w-full min-w-0 items-center gap-3 border-b border-[var(--border)] px-3 py-2 last:border-0 sm:px-4"
      >
        <span className="w-8 shrink-0 tabular-nums text-xs text-[var(--muted-foreground)]">
          {idx + 1}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">
          {payslip.fileName}
        </span>
        <span className="min-w-0 flex-1 text-xs text-[var(--muted-foreground)] sm:text-sm">
          {formatSentDate(payslip.timestamp)}
        </span>
        <span className="flex w-20 shrink-0 items-center justify-end gap-2">
          <ActionButton
            variant="download"
            ariaLabel="Download payslip"
            onClick={() =>
              window.open(payslip.fileUrl, "_blank", "noopener,noreferrer")
            }
          />
          {onDelete && <DeleteButton onClick={() => onDelete(payslip)} />}
        </span>
      </div>
    ))}
  </div>
);
