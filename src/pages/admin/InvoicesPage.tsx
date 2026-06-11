import { useCallback, useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import {
  AccordionRoot,
  AccordionItem,
  Button,
  Card,
} from "../../components/ui";
import {
  DialogContent,
  DialogRoot,
  DialogTitle,
} from "../../components/ui/dialog";
import { InvoicePills } from "../../components/InvoicePills";
import { FileInteractionButtons } from "../../components/FileInteractionButtons";
import { H2 } from "../../config/typography";
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
    try {
      await deleteInvoice(agencyId, invoiceId);
      toast({ title: "Invoice deleted", variant: "success" });
      fetchInvoices();
    } catch {
      toast({ title: "Failed to delete invoice", variant: "error" });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between">
          <H2>Invoices</H2>
        </div>

        {loading ? (
          <div className="mt-4 flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        ) : agencies.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No invoices found.</p>
        ) : (
          <div className="mt-3">
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
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border)] text-[var(--muted-foreground)]">
                          <th className="py-2 pr-4 font-medium">Invoice</th>
                          <th className="py-2 pr-4 font-medium">Uploaded</th>
                          <th className="py-2 pr-4 font-medium">Due Date</th>
                          <th className="py-2 pr-4 font-medium">Amount</th>
                          <th className="py-2 font-medium text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {agency.invoices.map((inv) => (
                          <tr
                            key={inv.id}
                            className="border-b border-[var(--border)] last:border-0"
                          >
                            <td className="py-2.5 pr-4 font-medium">
                              <span className="inline-flex items-center gap-1.5">
                                {inv.fileName}
                                <FileInteractionButtons
                                  fileUrl={inv.fileUrl}
                                  fileName={inv.fileName}
                                  size="md"
                                  interactionKey="invoice"
                                  onDelete={() =>
                                    handleDelete(agency.agencyId, inv.id)
                                  }
                                />
                              </span>
                            </td>
                            <td className="py-2.5 pr-4">
                              {new Date(inv.uploadedAt).toLocaleDateString(
                                "en-GB",
                                {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                },
                              )}
                            </td>
                            <td className="py-2.5 pr-4">
                              {new Date(inv.dueDate).toLocaleDateString(
                                "en-GB",
                                {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                },
                              )}
                            </td>
                            <td className="py-2.5 pr-4 font-medium">
                              £{parseFloat(inv.amountPayable).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {inv.status === "paid" ? (
                                <span
                                  className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-500/80 text-white shadow-[0_2px_8px_rgba(34,197,94,0.25)]"
                                  aria-label="Paid"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </span>
                              ) : (
                                <Button
                                  type="button"
                                  disabled={payingInvoice === inv.id}
                                  onClick={() =>
                                    setConfirmPaid({
                                      agencyId: agency.agencyId,
                                      invoiceId: inv.id,
                                      fileName: inv.fileName,
                                      clientName: agency.agencyName,
                                    })
                                  }
                                  className="h-10 px-4 text-xs"
                                >
                                  {payingInvoice === inv.id ? (
                                    <span className="inline-flex items-center gap-1">
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                      Paying...
                                    </span>
                                  ) : (
                                    "Mark as Paid"
                                  )}
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </AccordionItem>
              ))}
            </AccordionRoot>
          </div>
        )}
      </Card>

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
    </div>
  );
};
