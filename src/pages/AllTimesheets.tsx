import { useEffect, useRef, useState, useMemo } from "react";
import { httpsCallable } from "firebase/functions";
import { useData } from "../context/DataProvider";
import { useToast } from "../context/ToastProvider";
import { PaginatedFilterSection } from "../views/Table";
import { DeleteConfirmModal } from "../components/DeleteConfirmModal";
import { usePaginationParams } from "../hooks/usePaginationParams";
import { emptyFilters } from "../types/domain";
import { functions } from "../services/firebase";
import { formatTimesheetDate, type TimesheetEntry } from "../utils/timesheets";

interface DeleteTarget {
  clientId: string;
  clientName: string;
  entry: TimesheetEntry;
}

export const AllTimesheets = () => {
  useEffect(() => {
    document.title = "Timesheets";
  }, []);

  const { toast } = useToast();
  const {
    timesheets: agencies,
    timesheetsLoading: loading,
    refreshTimesheets,
    markSeen,
  } = useData();

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openValues] = useState<string[]>([]);
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const t of Object.values(timers)) {
        clearTimeout(t);
      }
    };
  }, []);

  useEffect(() => {
    const current = new Set(openValues);

    for (const agencyId of Object.keys(timersRef.current)) {
      if (!current.has(agencyId)) {
        clearTimeout(timersRef.current[agencyId]);
        delete timersRef.current[agencyId];
      }
    }

    for (const agencyId of openValues) {
      if (timersRef.current[agencyId]) continue;

      timersRef.current[agencyId] = setTimeout(() => {
        delete timersRef.current[agencyId];
        const agency = agencies.find((a) => a.agencyId === agencyId);
        if (!agency) return;
        const unseenIds = agency.timesheets
          .filter((ts) => ts.hasSeen === false)
          .map((ts) => ts.fileName);
        if (unseenIds.length > 0) {
          markSeen("timesheets", agencyId, unseenIds).catch(() => {});
        }
      }, 1500);
    }
  }, [openValues, agencies, markSeen]);

  const onDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const fn = httpsCallable(functions, "deleteTimesheet");
      await fn({
        clientId: deleteTarget.clientId,
        fileName: deleteTarget.entry.fileName,
      });
      toast({ title: "Timesheet deleted", variant: "success" });
      setDeleteTarget(null);
      refreshTimesheets();
    } catch {
      toast({
        title: "Delete failed",
        description: "Please try again.",
        variant: "error",
      });
    } finally {
      setDeleting(false);
    }
  };

  // Flatten timesheets from agency-grouped format to flat array
  const flatTimesheets = useMemo(() => {
    const result: TimesheetEntry[] = [];
    for (const agency of agencies) {
      for (const ts of agency.timesheets) {
        result.push(ts);
      }
    }
    return result;
  }, [agencies]);

  const { page, pageSize, setPage, setPageSize } = usePaginationParams();
  const totalPages = Math.max(1, Math.ceil(flatTimesheets.length / pageSize));
  const pagedTimesheets = useMemo(
    () => flatTimesheets.slice(page * pageSize, (page + 1) * pageSize),
    [flatTimesheets, page, pageSize],
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col space-y-4">
      <PaginatedFilterSection<TimesheetEntry>
        title="Timesheets"
        items={pagedTimesheets}
        loading={loading}
        page={page}
        totalPages={totalPages}
        totalResults={flatTimesheets.length}
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
        columnHeaders={["File Name", "Date Sent", "Sent By"]}
        emptyMessage="No timesheets uploaded yet."
        renderItem={(entry) => (
          <>
            <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
              {entry.fileName}
            </span>
            <span className="min-w-0 flex-1 text-xs text-[var(--muted-foreground)] sm:text-sm">
              {formatTimesheetDate(entry.uploadedAt)}
            </span>
            <span className="min-w-0 flex-1 text-xs text-[var(--muted-foreground)] sm:text-sm">
              {entry.uploadedBy}
            </span>
          </>
        )}
      />

      <DeleteConfirmModal
        open={deleteTarget !== null}
        deleting={deleting}
        label="timesheet"
        itemName={deleteTarget?.entry.fileName ?? ""}
        clientName={deleteTarget?.clientName ?? ""}
        onDelete={() => void onDelete()}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
};