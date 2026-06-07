import { useEffect, useRef, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { ActionButton, Button, Card, DialogContent, DialogRoot, DialogTitle, DownloadButton } from "./ui";
import { useAuth } from "../context/AuthProvider";
import { useToast } from "../context/ToastProvider";
import { functions } from "../services/firebase";
import { formatInvitedAt } from "../utils/date";
import { useAppStore, type CsvImport } from "../stores/appStore";
import { useFileStaffStore } from "../stores/fileStaffStore";
import { BodyMedium, Caption, Muted } from "../config/typography";

type CsvRow = Record<string, string>;

const EMPTY: CsvImport[] = [];

function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    if (values.length === 1 && values[0] === "") continue;
    const row: CsvRow = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });
    rows.push(row);
  }

  return { headers, rows };
}

interface ImportHistoryProps {
  type?: string;
  cloudFunction: string;
  getPreviewNames: (rows: CsvRow[]) => string[];
  onDeleteSuccess?: (importId?: string) => Promise<void>;
}

export const ImportHistory = ({
  type,
  cloudFunction,
  getPreviewNames,
  onDeleteSuccess,
}: ImportHistoryProps) => {
  const { appUser } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<CsvImport | null>(null);
  const [deletePreviewNames, setDeletePreviewNames] = useState<string[]>([]);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const cacheKey = type ?? "all";
  const history = useAppStore((s) => s.importHistoryCache[cacheKey] ?? EMPTY);
  const loaded = useAppStore((s) => s.importHistoryCacheLoaded[cacheKey]);
  const loadImportHistory = useAppStore((s) => s.loadImportHistory);
  const removeImportEntry = useAppStore((s) => s.removeImportEntry);

  useEffect(() => {
    if (deleteLoading) {
      deleteTimerRef.current = setTimeout(() => {
        toast({ title: "Still deleting...", variant: "info", replaceToast: true });
      }, 8000);
    }
    return () => {
      if (deleteTimerRef.current) {
        clearTimeout(deleteTimerRef.current);
        deleteTimerRef.current = null;
      }
    };
  }, [deleteLoading, toast]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!appUser || loaded) {
      setLoading(!loaded);
      return;
    }
    setLoading(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    loadImportHistory(type);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [appUser, type, loaded]);

  const onDeleteClick = async (entry: CsvImport) => {
    setDeleteTarget(entry);
    setDeletePreviewNames([]);
    setPreviewLoading(true);

    const cached = useFileStaffStore.getState().fileStaffMap[entry.id];
    if (cached && cached.staff.length > 0) {
      const names = getPreviewNames(cached.staff).filter(Boolean).sort(
        (a, b) => {
          const aParts = a.split(" ");
          const bParts = b.split(" ");
          const aKey = (
            type === "staff" && aParts.length >= 3 ? aParts[1] : aParts[0]
          ).toLowerCase();
          const bKey = (
            type === "staff" && bParts.length >= 3 ? bParts[1] : bParts[0]
          ).toLowerCase();
          return aKey.localeCompare(bKey);
        },
      );
      setDeletePreviewNames(names);
      setPreviewLoading(false);
      return;
    }

    if (!entry.fileUrl) {
      setPreviewLoading(false);
      return;
    }

    try {
      const resp = await fetch(entry.fileUrl);
      const text = await resp.text();
      const parsed = parseCsv(text);
      const names = getPreviewNames(parsed.rows).filter(Boolean).sort(
        (a, b) => {
          const aParts = a.split(" ");
          const bParts = b.split(" ");
          const aKey = (
            type === "staff" && aParts.length >= 3 ? aParts[1] : aParts[0]
          ).toLowerCase();
          const bKey = (
            type === "staff" && bParts.length >= 3 ? bParts[1] : bParts[0]
          ).toLowerCase();
          return aKey.localeCompare(bKey);
        },
      );
      setDeletePreviewNames(names);
    } catch {
      // silently fail
    } finally {
      setPreviewLoading(false);
    }
  };

  const onDeleteImport = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const callable = httpsCallable(functions, cloudFunction);
      const result = await callable({ importId: deleteTarget.id });
      const data = result.data as { importId?: string } | undefined;
      toast({
        title: "Import removed",
        description: `${deleteTarget.recordCount} record(s) and the import history entry were deleted.`,
        replaceToast: true,
      });
      removeImportEntry(type, deleteTarget.id);
      setDeleteTarget(null);
      setDeletePreviewNames([]);
      await onDeleteSuccess?.(data?.importId);
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof (error as { message?: string }).message === "string"
          ? (error as { message: string }).message
          : "Could not remove import right now.";
      toast({
        title: "Remove failed",
        description: message,
        variant: "error",
        replaceToast: true,
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <>
      <Card>
        <h2 className="text-base sm:text-lg font-bold">Import History</h2>
        {loading ? (
          <Muted className="mt-3">
            Loading...
          </Muted>
        ) : history.length === 0 ? (
          <Muted className="mt-3">
            No imports yet.
          </Muted>
        ) : (
          <div className="mt-3 space-y-2">
            {history.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center rounded-xl border border-[var(--border)] bg-[color:rgba(0,95,87,0.04)] px-3 py-2"
              >
                <ActionButton
                  variant="delete"
                  size="md"
                  ariaLabel={`Remove ${entry.fileName}`}
                  disabled={deleteTarget?.id === entry.id && deleteLoading}
                  onClick={() => onDeleteClick(entry)}
                />
                {entry.fileUrl ? (
                  <DownloadButton
                    size="md"
                    href={entry.fileUrl}
                    ariaLabel="Download CSV"
                    className="ml-1.5"
                  />
                ) : null}
                <div className="ml-2 min-w-0 flex-1">
                  <BodyMedium className="truncate">
                    {entry.fileName}
                  </BodyMedium>
                  <Caption>
                    {entry.recordCount} record(s) &middot;{" "}
                    {entry.importedByEmail ?? "Unknown"} &middot;{" "}
                    {entry.importedAt
                      ? formatInvitedAt(entry.importedAt)
                      : "Unknown date"}
                  </Caption>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <DialogRoot
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleteLoading) {
            setDeleteTarget(null);
            setDeletePreviewNames([]);
          }
        }}
      >
        <DialogContent closeDisabled={deleteLoading} onClose={() => { if (!deleteLoading) setDeleteTarget(null); }}>
          <DialogTitle className="text-base sm:text-lg font-bold">
            Confirm Delete
          </DialogTitle>
          <Muted className="mt-2">
            This will permanently delete the following{" "}
            {deletePreviewNames.length} record(s) and the import history entry.
            This action cannot be undone.
          </Muted>
          <p className="mt-2 text-xs font-medium text-amber-600">
            Any staff assigned to agencies will be unassigned and must be
            re-assigned after deletion.
          </p>
          {type === "agency" && (
            <p className="mt-1 text-xs font-medium text-amber-600">
              Associated logins for these clients will also be revoked.
            </p>
          )}
          {previewLoading ? (
            <div className="mt-4 flex justify-center">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
            </div>
          ) : deletePreviewNames.length > 0 ? (
            <div
              className={`mt-3 columns-2 gap-x-4 ${deletePreviewNames.length > 15 ? "max-h-[360px] overflow-y-auto" : ""}`}
            >
              {deletePreviewNames.map((name, i) => (
                <p
                  key={i}
                  className="text-xs sm:text-sm font-bold text-[var(--foreground)] break-inside-avoid mb-1"
                >
                  {name}
                </p>
              ))}
            </div>
          ) : (
            <Muted className="mt-3">
              Unable to load names for this import.
            </Muted>
          )}
          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={previewLoading || deleteLoading}
              onClick={() => void onDeleteImport()}
            >
              {previewLoading
                ? "Loading..."
                : deleteLoading
                  ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      Removing...
                    </span>
                  )
                  : "Confirm"}
            </Button>
          </div>
        </DialogContent>
      </DialogRoot>
    </>
  );
};
