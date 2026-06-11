import { useEffect, useState } from "react";
import { Card } from "../../components/ui";
import { InvoiceCard } from "../../components/InvoiceCard";
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
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {invoices.map((inv) => (
              <InvoiceCard
                key={inv.id}
                invoice={inv}
                agencyId={appUser?.agencyId ?? ""}
                agencyName=""
                payingInvoice={null}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
