import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import { Section } from "../components/Section";
import { InformationCard } from "../components/InformationCard";
import { Button } from "../components/ui";
import { useAuth } from "../context/AuthProvider";
import { useData } from "../context/DataProvider";
import { getClientByEmail } from "../services/firestore";

export const Invoices = () => {
  const { appUser } = useAuth();
  const {
    invoices,
    invoicesLoading: loading,
    markSeen,
    markDownloaded,
  } = useData();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    if (!appUser?.email) return;
    getClientByEmail(appUser.email).then((doc) => {
      if (doc?.id) setClientId(doc.id as string);
    });
  }, [appUser?.email]);

  const myInvoices = useMemo(() => {
    return invoices.flatMap((a) => a.invoices);
  }, [invoices]);

  useEffect(() => {
    if (!loading && clientId && myInvoices.length > 0) {
      const unseenIds = myInvoices
        .filter((inv) => inv.hasSeen === false)
        .map((inv) => inv.id);
      if (unseenIds.length > 0) {
        timerRef.current = setTimeout(() => {
          markSeen("invoices", clientId, unseenIds).catch(() => {});
        }, 3000);
      }
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [loading, clientId, myInvoices, markSeen]);

  return (
    <div className="space-y-4">
      <Section title="Invoices">
        {loading ? (
          <p className="text-sm text-zinc-500">Loading invoices...</p>
        ) : myInvoices.length === 0 ? (
          <p className="text-sm text-zinc-500">No invoices found.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {myInvoices.map((inv) => {
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
                  admin={false}
                  documentInfo={
                    <span
                      className="text-lg sm:text-xl font-bold tracking-tight"
                      style={{
                        color: isPaid ? "var(--accent)" : "var(--primary)",
                      }}
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
                      <Button
                        type="button"
                        onClick={() => {
                          window.open(
                            inv.fileUrl,
                            "_blank",
                            "noopener,noreferrer",
                          );
                          markDownloaded("invoices", clientId || inv.agencyId, [
                            inv.id,
                          ]).catch(() => {});
                        }}
                      >
                        Download
                      </Button>
                      {isPaid && (
                        <span className="inline-flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-green-500/80 text-white shadow-[0_2px_8px_rgba(34,197,94,0.25)]">
                          <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </span>
                      )}
                    </div>
                  }
                />
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
};
