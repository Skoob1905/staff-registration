import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  AccordionRoot,
  AccordionItem,
  Button,
} from "../../components/ui";
import { Section } from "../../components/Section";
import {
  DialogContent,
  DialogRoot,
  DialogTitle,
} from "../../components/ui/dialog";
import { InvoicePills } from "../../components/InvoicePills";
import { InvoiceCard } from "../../components/InvoiceCard";
import { DeleteConfirmModal } from "../../components/DeleteConfirmModal";
import { useToast } from "../../context/ToastProvider";
import {
  deleteInvoice,
  getAllInvoices,
  markInvoicePaid,
  type InvoiceEntry,
} from "../../services/invoiceService";

interface AgencyInvoices {
  agencyId: string;
  agencyName: string;
  invoices: InvoiceEntry[];
}

export const AdminInvoicesPage = () => {
  const { toast } = useToast();
  const [agencies, setAgencies] = useState<AgencyInvoices[]>([]);
  const [loading, setLoading] = useState(true);
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

  const fetchInvoices = useCallback(() => {
    setLoading(true);
    getAllInvoices()
      .then(setAgencies)
      .catch(() => setAgencies([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    fetchInvoices();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [fetchInvoices]);

  const handleMarkPaid = async (agencyId: string, invoiceId: string) => {
    setPayingInvoice(invoiceId);
    try {
      await markInvoicePaid(agencyId, invoiceId);
      toast({
        title: "Invoice marked as paid",
        variant: "success",
      });
      fetchInvoices();
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
      fetchInvoices();
    } catch {
      toast({ title: "Failed to delete invoice", variant: "error" });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-4">
      <Section title="Invoices">

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        ) : agencies.length === 0 ? (
          <p className="text-sm text-zinc-500">No invoices found.</p>
        ) : (
          <div>
            <AccordionRoot type="multiple">
              {agencies.map((agency) => (
                <AccordionItem
                  key={agency.agencyId}
                  value={agency.agencyId}
                  title={
                    <span className="flex items-center gap-2">
                      {agency.agencyName}
                      <InvoicePills invoices={agency.invoices} />
                    </span>
                  }
                  actions={
                    <span className="text-xs text-zinc-400">
                      Latest upload:{" "}
                      {(() => {
                        const latest = agency.invoices.reduce((a, b) =>
                          new Date(a.uploadedAt) > new Date(b.uploadedAt)
                            ? a
                            : b,
                        );
                        return new Date(latest.uploadedAt).toLocaleDateString(
                          "en-GB",
                          {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          },
                        );
                      })()}
                    </span>
                  }
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {agency.invoices.map((inv) => (
                      <InvoiceCard
                        key={inv.id}
                        invoice={inv}
                        agencyId={agency.agencyId}
                        agencyName={agency.agencyName}
                        admin
                        payingInvoice={payingInvoice}
                        onMarkPaid={() =>
                          setConfirmPaid({
                            agencyId: agency.agencyId,
                            invoiceId: inv.id,
                            fileName: inv.fileName,
                            clientName: agency.agencyName,
                          })
                        }
                        onDelete={(agencyId, invoiceId) =>
                          setDeleteTarget({
                            agencyId,
                            invoiceId,
                            fileName: inv.fileName,
                            clientName: agency.agencyName,
                          })
                        }
                      />
                    ))}
                  </div>
                </AccordionItem>
              ))}
            </AccordionRoot>
          </div>
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
          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              className="border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]"
              disabled={payingInvoice !== null}
              onClick={() => setConfirmPaid(null)}
            >
              Cancel
            </Button>
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
