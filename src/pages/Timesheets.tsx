import { useEffect, useMemo, useRef } from "react";
import { Button } from "../components/ui";
import { useAuth } from "../context/AuthProvider";
import { useData } from "../context/DataProvider";
import { PaginatedFilterSection } from "../views/Table";
import { usePaginationParams } from "../hooks/usePaginationParams";
import { emptyFilters } from "../types/domain";
import {
  formatTimesheetDate,
  type TimesheetEntry,
} from "../utils/timesheets";

export const Timesheets = () => {
  const { appUser } = useAuth();
  const {
    timesheets,
    timesheetsLoading: loading,
    markSeen,
    markDownloaded,
  } = useData();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const myTimesheets = useMemo(() => {
    return timesheets.flatMap((a) => a.timesheets);
  }, [timesheets]);

  useEffect(() => {
    if (!loading && appUser?.agencyId && myTimesheets.length > 0) {
      const unseenIds = myTimesheets
        .filter((ts) => ts.hasSeen === false)
        .map((ts) => ts.fileName);

      if (unseenIds.length > 0) {
        timerRef.current = setTimeout(() => {
          markSeen("timesheets", appUser.agencyId!, unseenIds).catch(() => {});
        }, 1500);
      }
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [loading, appUser?.agencyId, myTimesheets, markSeen]);

  const { page, pageSize, setPage, setPageSize } = usePaginationParams();
  const totalPages = Math.max(1, Math.ceil(myTimesheets.length / pageSize));
  const pagedTimesheets = useMemo(
    () => myTimesheets.slice(page * pageSize, (page + 1) * pageSize),
    [myTimesheets, page, pageSize],
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col space-y-4">
      <PaginatedFilterSection<TimesheetEntry>
        title="Timesheets"
        items={pagedTimesheets}
        loading={loading}
        page={page}
        totalPages={totalPages}
        totalResults={myTimesheets.length}
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
        columnHeaders={["File Name", "Date Sent", "Sent By", "Actions"]}
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
            <span className="min-w-0 flex-1">
              <Button
                type="button"
                onClick={() => {
                  window.open(entry.fileUrl, "_blank", "noopener,noreferrer");
                  markDownloaded("timesheets", appUser?.agencyId ?? "", [
                    entry.fileName,
                  ]).catch(() => {});
                }}
              >
                Download
              </Button>
            </span>
          </>
        )}
      />
    </div>
  );
};
