import { useEffect, useMemo, useRef, useState } from "react";
import { ActionButton } from "../components/ui";
import { useAuth } from "../context/AuthProvider";
import { useData } from "../context/DataProvider";
import { getClientByEmail } from "../services/firestore";
import { PaginatedFilterSection } from "../views/Table";
import { usePaginationParams } from "../hooks/usePaginationParams";
import { emptyFilters } from "../types/domain";
import type { InvoiceEntry } from "../services/invoiceService";

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
        }, 1500);
      }
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [loading, clientId, myInvoices, markSeen]);

  const { page, pageSize, setPage, setPageSize } = usePaginationParams();
  const totalPages = Math.max(1, Math.ceil(myInvoices.length / pageSize));
  const pagedInvoices = useMemo(
    () => myInvoices.slice(page * pageSize, (page + 1) * pageSize),
    [myInvoices, page, pageSize],
  );

  const downloadInvoice = (inv: InvoiceEntry) => {
    window.open(inv.fileUrl, "_blank", "noopener,noreferrer");
    markDownloaded("invoices", clientId || inv.agencyId, [inv.id]).catch(
      () => {},
    );
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col space-y-4">
      <PaginatedFilterSection<InvoiceEntry>
        title="Invoices"
        items={pagedInvoices}
        loading={loading}
        page={page}
        totalPages={totalPages}
        totalResults={myInvoices.length}
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
        columnHeaders={[
          "Name",
          "Amount",
          "Sent On",
          "Due On",
          "Status",
          "Actions",
        ]}
        emptyMessage="No invoices found."
        renderItem={(inv) => {
          const isPaid = inv.status === "paid";
          const amount = parseFloat(inv.amountPayable).toFixed(2);

          return (
            <>
              <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                {inv.fileName}
              </span>
              <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium">
                £{amount}
              </span>
              <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-[var(--muted-foreground)] sm:text-sm">
                {new Date(inv.uploadedAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
              <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-[var(--muted-foreground)] sm:text-sm">
                {new Date(inv.dueDate).toLocaleDateString("en-GB", {
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
              <span className="min-w-0 flex-1">
                <ActionButton
                  variant="download"
                  ariaLabel="Download invoice"
                  onClick={() => downloadInvoice(inv)}
                />
              </span>
            </>
          );
        }}
      />
    </div>
  );
};
