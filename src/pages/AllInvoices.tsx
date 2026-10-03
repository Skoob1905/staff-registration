import { useState, useMemo } from "react";
import {
  DialogContent,
  DialogRoot,
  DialogTitle,
} from "../components/ui/dialog";
import { ActionButton, Button } from "../components/ui";
import { useData } from "../context/DataProvider";
import { useToast } from "../context/ToastProvider";
import { PaginatedFilterSection } from "../views/Table";
import { DeleteConfirmModal } from "../components/DeleteConfirmModal";
import { usePaginationParams } from "../hooks/usePaginationParams";
import { emptyFilters } from "../types/domain";
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

  const { page, pageSize, setPage, setPageSize } = usePaginationParams();
  const totalPages = Math.max(1, Math.ceil(flatInvoices.length / pageSize));
  const pagedInvoices = useMemo(
    () => flatInvoices.slice(page * pageSize, (page + 1) * pageSize),
    [flatInvoices, page, pageSize],
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col space-y-4">
      <PaginatedFilterSection<InvoiceEntry>
        title="Invoices"
        items={pagedInvoices}
        loading={loading}
        page={page}
        totalPages={totalPages}
        totalResults={flatInvoices.length}
        pageSize={pageSize}
        onPrevPage={() => setPage(Math.max(0, page - 1))}
        onNextPage={() => setPage(page + 1)}
        onGoToPage={setPage}
        onPageSizeChange={setPageSize}
        filters={emptyFilters}
        onFiltersChange={() => {}}
        enableNameFilter={false}
        enableTagFilter={false}
        expandable={false}
        columnHeaders={["Name", "Amount", "Sent On", "Due On", "Status", "Actions"]}
        emptyMessage="No invoices found."
        renderItem={(invoice) => {
          const isPaid = invoice.status === "paid";
          const amount = parseFloat(invoice.amountPayable).toFixed(2);

          return (
            <>
              <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                {invoice.fileName}
              </span>
              <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium">
                £{amount}
              </span>
              <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-[var(--muted-foreground)] sm:text-sm">
                {new Date(invoice.uploadedAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
              <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-[var(--muted-foreground)] sm:text-sm">
                {new Date(invoice.dueDate).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
              <span
                className={`min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-medium ${
                  isPaid ? "text-green-600" : "text-red-600"
                }`}
              >
                {isPaid ? "Paid" : "Not Paid"}
              </span>
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <ActionButton
                  variant="download"
                  ariaLabel="Download invoice"
                  onClick={() =>
                    window.open(invoice.fileUrl, "_blank", "noopener,noreferrer")
                  }
                />
                {!isPaid && (
                  <ActionButton
                    variant="paid"
                    ariaLabel="Mark invoice as paid"
                    onClick={() =>
                      setConfirmPaid({
                        agencyId: invoice.agencyId,
                        invoiceId: invoice.id,
                        fileName: invoice.fileName,
                        clientName: invoice.agencyName,
                      })
                    }
                  />
                )}
                <ActionButton
                  variant="delete"
                  ariaLabel="Delete invoice"
                  onClick={() =>
                    setDeleteTarget({
                      agencyId: invoice.agencyId,
                      invoiceId: invoice.id,
                      fileName: invoice.fileName,
                      clientName: invoice.agencyName,
                    })
                  }
                />
              </span>
            </>
          );
        }}
      />

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
