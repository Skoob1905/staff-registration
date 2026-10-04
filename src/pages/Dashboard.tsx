import { useEffect, useMemo, useState } from "react";
import { getStaffByEmail } from "../services/firestore";
import { PageTitle } from "../components/PageTitle";
import { Pill } from "../components/Pill";
import { InformationCard } from "../components/InformationCard";
import { ActionButton, Button } from "../components/ui";
import { useAuth } from "../context/AuthProvider";
import { getPayslipsForUser, markPayslipDownloaded } from "../services/payslipService";
import { PaginatedFilterSection } from "../views/Table";
import { usePaginationParams } from "../hooks/usePaginationParams";
import { emptyFilters } from "../types/domain";
import { formatSentDate } from "../utils/date";
import type { Payslip } from "../types/domain";
import { Body, Muted } from "../config/typography";

interface StaffDocumentEntry {
  fileName: string;
  fileUrl: string;
  uploadedBy: string;
  uploadedAt: string;
}

export const Dashboard = () => {
  useEffect(() => {
    document.title = "Dashboard";
  }, []);

  const { appUser } = useAuth();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [documents, setDocuments] = useState<StaffDocumentEntry[]>([]);

  useEffect(() => {
    if (!appUser) return;
    const run = async () => {
      try {
        const slips = await getPayslipsForUser(appUser.email);
        setPayslips(slips);
      } catch (err) {
        console.error("Failed to fetch payslips", err);
      }

      try {
        const staffRecords = await getStaffByEmail(appUser.email ?? "");
        if (staffRecords.length > 0) {
          const data = staffRecords[0] as {
            metadata?: { documents?: StaffDocumentEntry[] };
          };
          setDocuments(data.metadata?.documents ?? []);
        }
      } catch (err) {
        console.error("Failed to fetch staff documents", err);
      }
    };
    void run();
  }, [appUser]);

  const { page, pageSize, setPage, setPageSize } = usePaginationParams();
  const totalPages = Math.max(1, Math.ceil(payslips.length / pageSize));
  const pagedPayslips = useMemo(
    () => payslips.slice(page * pageSize, (page + 1) * pageSize),
    [payslips, page, pageSize],
  );

  const downloadPayslip = (payslip: Payslip) => {
    window.open(payslip.fileUrl, "_blank", "noopener,noreferrer");
    markPayslipDownloaded(payslip.id).catch((err) => {
      console.error("Failed to mark payslip as downloaded", err);
    });
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col space-y-4">
      <PageTitle>
        <span className="flex items-center gap-2">
          Dashboard
          <Pill status="registered" />
        </span>
      </PageTitle>
      <Body className="px-4">Nothing to do</Body>

      <div>
        <PageTitle>Documents ({documents.length})</PageTitle>
        <div className="px-4">
          {documents.length === 0 ? (
            <Muted>No documents available.</Muted>
          ) : (
            <div className="flex flex-col gap-3">
              {documents.map((doc, idx) => (
                <InformationCard
                  key={idx}
                  variant="document"
                  name={doc.fileName}
                  isNew={false}
                  hasDownloaded={false}
                  uploadedAt={doc.uploadedAt}
                  admin={false}
                  documentInfo={null}
                  actions={
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <Button
                        type="button"
                        onClick={() => {
                          window.open(
                            doc.fileUrl,
                            "_blank",
                            "noopener,noreferrer",
                          );
                        }}
                      >
                        Download
                      </Button>
                    </div>
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <PaginatedFilterSection<Payslip>
        title="Payslips"
        items={pagedPayslips}
        loading={false}
        page={page}
        totalPages={totalPages}
        totalResults={payslips.length}
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
        columnHeaders={["Payslip", "Sent On", "Actions"]}
        emptyMessage="No payslips available."
        renderItem={(payslip) => (
          <>
            <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
              {payslip.fileName}
            </span>
            <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-[var(--muted-foreground)] sm:text-sm">
              {formatSentDate(payslip.timestamp)}
            </span>
            <span className="min-w-0 flex-1">
              <ActionButton
                variant="download"
                ariaLabel="Download payslip"
                onClick={() => downloadPayslip(payslip)}
              />
            </span>
          </>
        )}
      />
    </div>
  );
};
