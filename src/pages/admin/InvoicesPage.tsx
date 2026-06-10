import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AccordionRoot, AccordionItem, Button, Card } from "../../components/ui";
import { H2 } from "../../config/typography";
import { useToast } from "../../context/ToastProvider";
import {
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

  const statusPill = (status: string) => {
    if (status === "unpaid") {
      return (
        <span className="ml-2 inline-block rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
          Unpaid
        </span>
      );
    }
    return (
      <span className="ml-2 inline-block rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
        Paid
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <H2>Invoices</H2>

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
                      {agency.invoices.some((inv) => inv.status === "unpaid") && (
                        <span className="inline-block rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
                          Unpaid
                        </span>
                      )}
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
                          <th className="py-2 pr-4 font-medium">Status</th>
                          <th className="py-2 font-medium" />
                        </tr>
                      </thead>
                      <tbody>
                        {agency.invoices.map((inv) => (
                          <tr key={inv.id} className="border-b border-[var(--border)] last:border-0">
                            <td className="py-2.5 pr-4 font-medium">
                              <a
                                href={inv.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm underline text-[var(--primary)]"
                              >
                                {inv.fileName}
                              </a>
                            </td>
                            <td className="py-2.5 pr-4">
                              {new Date(inv.uploadedAt).toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </td>
                            <td className="py-2.5 pr-4">
                              {new Date(inv.dueDate).toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </td>
                            <td className="py-2.5 pr-4 font-medium">
                              £{parseFloat(inv.amountPayable).toFixed(2)}
                            </td>
                            <td className="py-2.5">{statusPill(inv.status)}</td>
                            <td className="py-2.5">
                              {inv.status === "unpaid" && (
                                <Button
                                  type="button"
                                  disabled={payingInvoice === inv.id}
                                  onClick={() => handleMarkPaid(agency.agencyId, inv.id)}
                                >
                                  {payingInvoice === inv.id ? (
                                    <span className="inline-flex items-center gap-1">
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                      Paying...
                                    </span>
                                  ) : (
                                    "Mark Paid"
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
    </div>
  );
};
