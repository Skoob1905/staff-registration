import { useEffect, useState } from "react";
import { Section } from "../../components/Section";
import { InvoiceCard } from "../../components/InvoiceCard";
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
      <Section title="Invoices">
        {loading ? (
          <p className="text-sm text-zinc-500">Loading invoices...</p>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-zinc-500">No invoices found.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
      </Section>
    </div>
  );
};
