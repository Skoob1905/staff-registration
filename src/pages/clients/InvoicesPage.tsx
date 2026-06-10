import { useEffect, useState } from "react";
import { Card } from "../../components/ui";
import { H2 } from "../../config/typography";
import { useAuth } from "../../context/AuthProvider";
import { getInvoicesForAgency, type InvoiceEntry } from "../../services/invoiceService";

const statusStyles: Record<string, string> = {
  paid: "bg-green-100 text-green-700",
  unpaid: "bg-amber-100 text-amber-700",
};

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

  const outstandingTotal = invoices
    .filter((inv) => inv.status === "unpaid")
    .reduce((sum, inv) => sum + (parseFloat(inv.amountPayable) || 0), 0);

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between">
          <H2>Invoices</H2>
          <span className="text-xs text-[var(--muted-foreground)]">
            Outstanding: £{outstandingTotal.toFixed(2)}
          </span>
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
                  <th className="py-2 pr-4 font-medium">Agency</th>
                  <th className="py-2 pr-4 font-medium">Due Date</th>
                  <th className="py-2 pr-4 font-medium">Amount</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
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
                    <td className="py-2.5 pr-4">{inv.agencyName || inv.agencyId}</td>
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
                    <td className="py-2.5">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          statusStyles[inv.status] || "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {inv.status === "paid" ? "Paid" : "Unpaid"}
                      </span>
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
