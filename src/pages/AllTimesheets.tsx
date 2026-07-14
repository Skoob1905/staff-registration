import { useEffect, useRef, useState } from "react";
import { useAccordionParams } from "../hooks/useAccordionParams";
import { httpsCallable } from "firebase/functions";
import { AccordionAction, AccordionItem, AccordionRoot, Button, DeleteButton } from "../components/ui";
import { Section } from "../components/Section";
import { AccordionTitle } from "../components/AccordionTitle";
import { InformationCard } from "../components/InformationCard";
import { DeleteConfirmModal } from "../components/DeleteConfirmModal";
import { Pill } from "../components/Pill";
import { useToast } from "../context/ToastProvider";
import { useData } from "../context/DataProvider";
import { functions } from "../services/firebase";
import {
  getLatestTimesheetUpload,
  formatTimesheetDate,
  type TimesheetEntry,
} from "../utils/timesheets";

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
    timesheetsByAgency,
    refreshTimesheets,
    markSeen,
    markDownloaded,
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

  const { openValues, handleAccordionChange } = useAccordionParams();

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

  return (
    <div className="mx-auto space-y-4">
      <Section title="Timesheets">
        {loading ? (
          <p className="text-sm text-zinc-500">Loading...</p>
        ) : agencies.length === 0 ? (
          <p className="text-sm text-zinc-500">No timesheets uploaded yet.</p>
        ) : (
          <AccordionRoot
            className="mt-1.5 sm:mt-3 space-y-3"
            type="multiple"
            value={openValues}
            onValueChange={handleAccordionChange}
          >
            {agencies.map((agency, idx) => {
              const latestUpload = getLatestTimesheetUpload(agency.timesheets)!;

              return (
                <AccordionItem
                  key={agency.agencyId}
                  value={agency.agencyId}
                  className="animate-cascade"
                  style={
                    { animationDelay: `${idx * 5}ms` } as React.CSSProperties
                  }
                  title={
                    <span className="flex items-center gap-2">
                      <AccordionTitle>{agency.agencyName}</AccordionTitle>
                      {timesheetsByAgency[agency.agencyId] > 0 && (
                        <Pill
                          status="new"
                          count={timesheetsByAgency[agency.agencyId]}
                        />
                      )}
                    </span>
                  }
                  actions={
                    <AccordionAction>
                      {"Latest upload: " + formatTimesheetDate(latestUpload.uploadedAt)}
                    </AccordionAction>
                  }
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {agency.timesheets.map((entry, entryIdx) => (
                      <InformationCard
                        key={entryIdx}
                        variant="timesheet"
                        name={entry.fileName}
                        isNew={entry.hasSeen === false}
                        hasDownloaded={!!entry.hasDownloaded}
                        uploadedAt={entry.uploadedAt}
                        admin
                        documentInfo={null}
                        actions={
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <Button
                              type="button"
                              onClick={() => {
                                window.open(entry.fileUrl, "_blank", "noopener,noreferrer");
                                markDownloaded("timesheets", agency.agencyId, [entry.fileName]).catch(() => {});
                              }}
                            >
                              Download
                            </Button>
                            <DeleteButton
                              onClick={() => {
                                setDeleteTarget({
                                  clientId: agency.agencyId,
                                  clientName: agency.agencyName,
                                  entry,
                                });
                              }}
                            />
                          </div>
                        }
                      />
                    ))}
                  </div>
                </AccordionItem>
              );
            })}
          </AccordionRoot>
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
