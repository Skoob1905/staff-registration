import { Check, Loader2, Receipt } from "lucide-react";
import { Button } from "./ui";
import type { InvoiceEntry } from "../services/invoiceService";

interface InvoiceCardProps {
  invoice: InvoiceEntry;
  agencyId: string;
  agencyName: string;
  admin?: boolean;
  payingInvoice: string | null;
  onMarkPaid?: (agencyId: string, invoiceId: string) => void;
  onDelete?: (agencyId: string, invoiceId: string) => void;
}

export function InvoiceCard({
  invoice,
  agencyId,
  agencyName: _agencyName,
  admin = false,
  payingInvoice,
  onMarkPaid,
  onDelete,
}: InvoiceCardProps) {
  const isPaid = invoice.status === "paid";
  const amount = parseFloat(invoice.amountPayable).toFixed(2);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-[var(--primary)]/15 p-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] animate-cascade"
      style={{
        background: isPaid
          ? `linear-gradient(to top, rgba(34,197,94,0.05), transparent 50%),
             linear-gradient(135deg, rgba(34,197,94,0.04), transparent),
             radial-gradient(ellipse at 100% 0%, rgba(34,197,94,0.06), transparent 55%)`
          : `linear-gradient(to top, rgba(20,184,166,0.06), transparent 50%),
             radial-gradient(ellipse at 100% 0%, rgba(20,184,166,0.06), transparent 55%),
             radial-gradient(ellipse at 0% 100%, rgba(20,184,166,0.02), transparent 45%),
             linear-gradient(135deg, rgba(20,184,166,0.04), transparent)`,
      }}
    >
      <div
        className="pointer-events-none absolute -right-20 top-1/2 h-32 w-[380px] -translate-y-1/2 rotate-[-30deg] opacity-10 blur-xl"
        style={{ background: "var(--accent)" }}
      />
      <Receipt
        className="pointer-events-none absolute right-2/10 top-6/7 h-40 w-40 -translate-y-1/2 text-[var(--accent)]/10 rotate-[-20deg]"
        strokeWidth={1}
      />
      <div className="flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-3">
          <span className="truncate text-base font-bold">
            {invoice.fileName}
          </span>
          <div className="flex flex-col items-end gap-0.5 shrink-0">
            <span
              className="text-xl font-bold tracking-tight"
              style={{ color: isPaid ? "var(--accent)" : "var(--primary)" }}
            >
              <span className="text-sm">£</span>
              {amount}
            </span>
            <span className="text-xs text-[var(--muted-foreground)]">
              Due:{" "}
              {new Date(invoice.dueDate).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              onClick={() =>
                window.open(invoice.fileUrl, "_blank", "noopener,noreferrer")
              }
            >
              Download
            </Button>
            {admin && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(agencyId, invoice.id)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl border border-[var(--destructive)]/20 bg-[var(--destructive-400)] text-[11px] font-semibold text-white transition-all hover:bg-[var(--destructive-500)]/85 hover:shadow-[0_2px_12px_rgba(220,38,38,0.25)]"
              >
                Delete
              </button>
            )}
          </div>

          {isPaid ? (
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-green-500/80 text-white shadow-[0_2px_8px_rgba(34,197,94,0.25)]">
              <Check className="h-4 w-4" />
            </span>
          ) : admin && onMarkPaid ? (
            <Button
              type="button"
              disabled={payingInvoice === invoice.id}
              onClick={() => onMarkPaid(agencyId, invoice.id)}
              className="h-8 px-3 text-[11px]"
            >
              {payingInvoice === invoice.id ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Paying...
                </span>
              ) : (
                "Mark as Paid"
              )}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
