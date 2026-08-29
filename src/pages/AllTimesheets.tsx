import { useEffect, useRef, useState, useMemo } from "react";
import { httpsCallable } from "firebase/functions";
import { Section } from "../components/Section";
import { useData } from "../context/DataProvider";
import { useToast } from "../context/ToastProvider";
import { TableView } from "../views/Table/TableView";
import { DeleteConfirmModal } from "../components/DeleteConfirmModal";
import { formatTimesheetDate } from "../utils/timesheets";

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
        result.push({
          ...ts,
          _agencyName: agency.agencyName,
        });
      }
    }
    return result;
  }, [agencies]);

  return (
    <div className="mx-auto space-y-4">
      <Section title="Timesheets">
        {loading ? (
          <p className="text-sm text-zinc-500">Loading...</p>
        ) : flatTimesheets.length === 0 ? (
          <p className="text-sm text-zinc-500">No timesheets uploaded yet.</p>
        ) : (
<TableView
              title="Timesheets"
              expandable={false}
              columnHeaders={["Columns", "File Name", "Date Sent", "Sent By"]}
              renderItem={(entry, idx) => (
                <span className="flex items-center gap-2">
                  <span className="tabular-nums">{idx + 1}</span>
                  <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                    {entry.fileName}
                  </span>
                  <span className="text-xs sm:text-sm text-[var(--muted-foreground)] flex-1">
                    {formatTimesheetDate(entry.uploadedAt)}
                  </span>
                  <span className="text-xs sm:text-sm text-[var(--muted-foreground)] flex-1">
                    {entry.uploadedBy}
                  </span>
                </span>
              )}
            />
        )}
      </Section>

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