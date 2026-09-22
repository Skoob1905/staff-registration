import { useState, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { Section } from "../components/Section";
import {
  DialogContent,
  DialogRoot,
  DialogTitle,
} from "../components/ui/dialog";
import { Button } from "../components/ui";
import { useData } from "../context/DataProvider";
import { useToast } from "../context/ToastProvider";
import { TableView } from "../views/Table/TableView";
import { DeleteConfirmModal } from "../components/DeleteConfirmModal";
import { deleteInvoice, markInvoicePaid } from "../services/invoiceService";

interface InvoiceEntry {
  id: string;
  fileName: string;
  fileUrl: string;
  uploadedBy: string;
  uploadedAt: string;
  dueDate: string;
  amountPayable: string;
  agencyName: string;
  agencyId: string;
  status: "unpaid" | "paid" | "review";
  paidAt?: string;
  paidBy?: string;
  hasSeen?: boolean;
  hasDownloaded?: boolean;
}

export const AllInvoices = () => {
  const { toast } = useToast();
  const {
    invoices: agencies,
    invoicesLoading: loading,
    refreshInvoices,
  } = useData();
  const [payingInvoice, setPayingInvoice] = useState<string | null>(null);
  const [confirmPaid, setConfirmPaid] = useState<{
    agencyId: string;
    invoiceId: string;
    fileName: string;
    clientName: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    agencyId: string;
    invoiceId: string;
    fileName: string;
    clientName: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleMarkPaid = async (agencyId: string, invoiceId: string) => {
    setPayingInvoice(invoiceId);
    try {
      await markInvoicePaid(agencyId, invoiceId);
      toast({
        title: "Invoice marked as paid",
        variant: "success",
      });
      refreshInvoices();
    } catch {
      toast({
        title: "Failed to mark invoice as paid",
        variant: "error",
      });
    } finally {
      setPayingInvoice(null);
    }
  };

  const handleDelete = async (agencyId: string, invoiceId: string) => {
    setDeleting(true);
    try {
      await deleteInvoice(agencyId, invoiceId);
      toast({ title: "Invoice deleted", variant: "success" });
      refreshInvoices();
    } catch {
      toast({ title: "Failed to delete invoice", variant: "error" });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  // Flatten invoices from agency-grouped format to flat array
  const flatInvoices = useMemo(() => {
    const result: InvoiceEntry[] = [];
    for (const agency of agencies) {
      for (const inv of agency.invoices) {
        result.push({
          ...inv,
        });
      }
    }
    return result;
  }, [agencies]);

  return (
    <div className="space-y-4">
      <Section title="Invoices">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        ) : flatInvoices.length === 0 ? (
          <p className="text-sm text-zinc-500">No invoices found.</p>
        ) : (
          <TableView
            title="Invoices"
            expandable={false}
            columnHeaders={["Name", "Amount", "Sent On", "Due On", "Status"]}
            renderItem={(invoice) => {
              const isPaid = invoice.status === "paid";
              const amount = parseFloat(invoice.amountPayable).toFixed(2);

              return (
                <span className="flex items-center gap-2">
                  <span className="tabular-nums">{/* index */}</span>
                  <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                    {invoice.fileName}
                  </span>
                  <span className="text-right text-sm font-medium">
                    £{amount}
                  </span>
                  <span className="text-xs sm:text-sm text-[var(--muted-foreground)] flex-1">
                    {new Date(invoice.uploadedAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  <span className="text-xs sm:text-sm text-[var(--muted-foreground)] flex-1">
                    {new Date(invoice.dueDate).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  <span
                    className={
                      isPaid
                        ? "text-green-600 font-medium"
                        : "text-red-600 font-medium"
                    }
                  >
                    {isPaid ? "Paid" : "Not Paid"}
                  </span>
                </span>
              );
            }}
          />
        )}
      </Section>

      <DialogRoot
        open={confirmPaid !== null}
        onOpenChange={(open) => !open && setConfirmPaid(null)}
      >
        <DialogContent
          onClose={() => setConfirmPaid(null)}
          closeDisabled={payingInvoice !== null}
        >
          <DialogTitle className="font-bold">
            Confirmation of Payment
          </DialogTitle>
          <p className="mt-3 text-sm text-zinc-600">
            This action cannot be undone without deleting and re-issuing the
            invoice.
          </p>
          <div className="mt-4 space-y-1 text-sm">
            <p>
              <span className="font-semibold">Invoice Name:</span>{" "}
              {confirmPaid?.fileName}
            </p>
            <p>
              <span className="font-semibold">Client:</span>{" "}
              {confirmPaid?.clientName}
            </p>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              disabled={payingInvoice !== null}
              className="bg-green-600 hover:bg-green-700"
              onClick={() => {
                if (!confirmPaid) return;
                handleMarkPaid(confirmPaid.agencyId, confirmPaid.invoiceId);
                setConfirmPaid(null);
              }}
            >
              {payingInvoice !== null ? "Marking..." : "Mark as Paid"}
            </Button>
          </div>
        </DialogContent>
      </DialogRoot>

      <DeleteConfirmModal
        open={deleteTarget !== null}
        deleting={deleting}
        label="invoice"
        itemName={deleteTarget?.fileName ?? ""}
        clientName={deleteTarget?.clientName ?? ""}
        onDelete={() => {
          if (!deleteTarget) return;
          void handleDelete(deleteTarget.agencyId, deleteTarget.invoiceId);
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
};
