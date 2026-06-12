import { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import {
  AccordionItem,
  AccordionRoot,
} from "../../components/ui";
import { Section } from "../../components/Section";
import { FileInteractionButtons } from "../../components/FileInteractionButtons";
import { Metadata } from "../../components/Metadata";
import { DeleteConfirmModal } from "../../components/DeleteConfirmModal";
import { useAuth } from "../../context/AuthProvider";
import { useToast } from "../../context/ToastProvider";
import { usePaginatedRecords } from "../../hooks/usePaginatedRecords";
import { functions } from "../../services/firebase";
import {
  getLatestTimesheetUpload,
  formatTimesheetDate,
  type TimesheetEntry,
} from "../../utils/timesheets";
import { getCompanyName } from "../../utils/company";

interface DeleteTarget {
  clientId: string;
  clientName: string;
  entry: TimesheetEntry;
}

export const AdminTimesheetsPage = () => {
  useEffect(() => {
    document.title = "Timesheets";
  }, []);

  const { appUser } = useAuth();
  const { toast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);

  const {
    items: clients,
    loading,
    refresh,
  } = usePaginatedRecords({
    indexName: "clients_name_desc",
    agencyId: appUser?.agencyId ?? "",
    hitsPerPage: 100,
  });

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
      refresh();
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

  const clientsWithTimesheets = clients.filter((c) => {
    const meta = (c as Record<string, unknown>).metadata as
      | Record<string, unknown>
      | undefined;
    return !!(meta?.timesheets as TimesheetEntry[] | undefined)?.length;
  });

  return (
    <div className="mx-auto space-y-4">
      <Section title="Timesheets">

        {loading ? (
          <p className="text-sm text-zinc-500">Loading...</p>
        ) : clientsWithTimesheets.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No timesheets uploaded yet.
          </p>
        ) : (
          <AccordionRoot className="mt-1.5 sm:mt-3 space-y-3" type="multiple">
            {clientsWithTimesheets.map((client) => {
              const record = client as Record<string, unknown>;
              const meta = record.metadata as
                | Record<string, unknown>
                | undefined;
              const timesheets =
                (meta?.timesheets as TimesheetEntry[] | undefined) ?? [];
              const name = getCompanyName(record);
              const latestUpload = getLatestTimesheetUpload(timesheets)!;

              return (
                <AccordionItem
                  key={record.id as string}
                  value={record.id as string}
                  title={name}
                  actions={
                    <span className="text-xs text-zinc-400">
                      Latest upload:{" "}
                      {formatTimesheetDate(latestUpload.uploadedAt)}
                    </span>
                  }
                >
                  {timesheets.map((entry, idx) => (
                    <div key={idx} className="py-2 text-xs sm:text-sm">
                      {/* Mobile layout */}
                      <div className="flex sm:hidden flex-col gap-1">
                        <Metadata
                          title="Timesheet"
                          value={
                            <span className="inline-flex items-center gap-2">
                              <span className="truncate min-w-0">
                                {entry.fileName}
                              </span>
                              <FileInteractionButtons
                                fileUrl={entry.fileUrl}
                                fileName={entry.fileName}
                                size="md"
                                interactionKey="timesheet"
                                onDelete={() => {
                                  setDeleteTarget({
                                    clientId: record.id as string,
                                    clientName: name,
                                    entry,
                                  });
                                }}
                              />
                            </span>
                          }
                        />
                        <Metadata
                          title="Uploaded by"
                          value={`${entry.uploadedBy} at ${formatTimesheetDate(entry.uploadedAt)}`}
                        />
                      </div>
                      {/* Desktop layout */}
                      <div className="hidden sm:flex items-center gap-3">
                        <FileInteractionButtons
                          fileUrl={entry.fileUrl}
                          fileName={entry.fileName}
                          size="md"
                          interactionKey="timesheet"
                          onDelete={() => {
                            setDeleteTarget({
                              clientId: record.id as string,
                              clientName: name,
                              entry,
                            });
                          }}
                        />
                        <span className="truncate flex-1">
                          {entry.fileName}
                        </span>
                        <Metadata
                          title="Uploaded by"
                          value={entry.uploadedBy}
                        />
                        <Metadata
                          title="Date"
                          value={formatTimesheetDate(entry.uploadedAt)}
                        />
                      </div>
                    </div>
                  ))}
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
