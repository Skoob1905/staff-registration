import { useState } from "react";
import { useAccordionParams } from "../hooks/useAccordionParams";
import { Check, Loader2 } from "lucide-react";
import {
  AccordionRoot,
  AccordionItem,
  Button,
  DeleteButton,
} from "../components/ui";
import { Section } from "../components/Section";
import {
  DialogContent,
  DialogRoot,
  DialogTitle,
} from "../components/ui/dialog";
import { InvoicePills } from "../components/InvoicePills";
import { AccordionTitle } from "../components/AccordionTitle";
import { InformationCard } from "../components/InformationCard";
import { DeleteConfirmModal } from "../components/DeleteConfirmModal";
import { useToast } from "../context/ToastProvider";
import { useData } from "../context/DataProvider";
import {
  deleteInvoice,
  markInvoicePaid,
} from "../services/invoiceService";

export const AllInvoicesPage = () => {
  const { toast } = useToast();
  const { invoices: agencies, invoicesLoading: loading, refreshInvoices, markDownloaded } = useData();
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

  const { openValues, handleAccordionChange } = useAccordionParams();

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
            <AccordionRoot
              type="multiple"
              value={openValues}
              onValueChange={handleAccordionChange}
            >
              {agencies.map((agency, idx) => (
                <AccordionItem
                  key={agency.agencyId}
                  value={agency.agencyId}
                  className="animate-cascade"
                  style={{ animationDelay: `${idx * 5}ms` } as React.CSSProperties}
                  title={
                    <span className="flex items-center gap-2">
                      <AccordionTitle>{agency.agencyName}</AccordionTitle>
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
                    {agency.invoices.map((inv) => {
                      const isPaid = inv.status === "paid";
                      const amount = parseFloat(inv.amountPayable).toFixed(2);

                      return (
                        <InformationCard
                          key={inv.id}
                          variant="invoice"
                          name={inv.fileName}
                          isNew={inv.hasSeen === false}
                          hasDownloaded={!!inv.hasDownloaded}
                          uploadedAt={inv.uploadedAt}
                          admin
                          documentInfo={
                            <span
                              className="text-lg sm:text-xl font-bold tracking-tight"
                              style={{ color: isPaid ? "var(--accent)" : "var(--primary)" }}
                            >
                              <span className="text-xs sm:text-sm">£</span>
                              {amount}
                            </span>
                          }
                          infoBottom={
                            <span className="text-xs sm:text-sm text-[var(--muted-foreground)]">
                              Due:{" "}
                              {new Date(inv.dueDate).toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                          }
                          actions={
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <Button
                                  type="button"
                                  onClick={() => {
                                    window.open(inv.fileUrl, "_blank", "noopener,noreferrer");
                                    markDownloaded("invoices", agency.agencyId, [inv.id]).catch(() => {});
                                  }}
                                >
                                  Download
                                </Button>
                                <DeleteButton
                                  onClick={() => {
                                    setDeleteTarget({
                                      agencyId: agency.agencyId,
                                      invoiceId: inv.id,
                                      fileName: inv.fileName,
                                      clientName: agency.agencyName,
                                    });
                                  }}
                                />
                              </div>

                              {isPaid ? (
                                <span className="inline-flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-green-500/80 text-white shadow-[0_2px_8px_rgba(34,197,94,0.25)]">
                                  <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
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
                                  className="h-7 px-2.5 sm:h-8 sm:px-3 text-[10px] sm:text-[11px]"
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
                            </div>
                          }
                        />
                      );
                    })}
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
