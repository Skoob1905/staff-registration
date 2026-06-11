import { useEffect, useState } from "react";
import { Card } from "../../components/ui";
import { FileInteractionButtons } from "../../components/FileInteractionButtons";
import { Pill } from "../../components/Pill";
import { H2 } from "../../config/typography";
import { useAuth } from "../../context/AuthProvider";
import {
  getInvoicesForAgency,
  type InvoiceEntry,
} from "../../services/invoiceService";

export const InvoicesPage = () => {
  const { appUser } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appUser?.agencyId) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    getInvoicesForAgency(appUser.agencyId)
      .then(setInvoices)
      .catch(() => setInvoices([]))
      .finally(() => setLoading(false));
  }, [appUser?.agencyId]);

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between">
          <H2>Invoices</H2>
        </div>

        {loading ? (
          <p className="mt-3 text-sm text-zinc-500">Loading invoices...</p>
        ) : invoices.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No invoices found.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--muted-foreground)]">
                  <th className="py-2 pr-4 font-medium">Invoice</th>
                  <th className="py-2 pr-4 font-medium">Due Date</th>
                  <th className="py-2 pr-4 font-medium">Amount</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <td className="py-2.5 pr-4 font-medium pl-2">
                      <span className="inline-flex items-center gap-2">
                        <FileInteractionButtons
                          fileUrl={inv.fileUrl}
                          fileName={inv.fileName}
                          size="md"
                          interactionKey="invoice"
                        />
                        {inv.fileName}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4">
                      {(() => {
                        const d = new Date(inv.dueDate);
                        const day = d.getDate();
                        const suffix =
                          day >= 11 && day <= 13
                            ? "th"
                            : day % 10 === 1
                              ? "st"
                              : day % 10 === 2
                                ? "nd"
                                : day % 10 === 3
                                  ? "rd"
                                  : "th";
                        return `${day}${suffix} ${d.toLocaleDateString("en-GB", { month: "long" })} ${d.getFullYear()}`;
                      })()}
                    </td>
                    <td className="py-2.5 pr-4 font-medium">
                      £{parseFloat(inv.amountPayable).toFixed(2)}
                    </td>
                    <td className="py-2.5">
                      <Pill status={inv.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
