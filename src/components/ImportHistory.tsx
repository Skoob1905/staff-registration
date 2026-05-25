import { useCallback, useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { Download } from "lucide-react";
import { Button, Card } from "./ui";
import { DialogContent, DialogRoot, DialogTitle } from "./ui/dialog";
import { useAuth } from "../context/AuthProvider";
import { useToast } from "../context/ToastProvider";
import { db, functions } from "../services/firebase";
import { formatInvitedAt, toDate } from "../utils/date";
import { useFileStaffStore } from "../stores/fileStaffStore";

type CsvRow = Record<string, string>;

interface CsvImport {
  id: string;
  fileName: string;
  fileUrl: string | null;
  recordCount: number;
  importedByUid: string;
  importedByEmail?: string | null;
  importedAt?: Date;
  type?: string;
}

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
  onDeleteSuccess: () => Promise<void>;
  version?: number;
}

export const ImportHistory = ({
  type,
  cloudFunction,
  getPreviewNames,
  onDeleteSuccess,
  version,
}: ImportHistoryProps) => {
  const { appUser } = useAuth();
  const { toast } = useToast();
  const [history, setHistory] = useState<CsvImport[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<CsvImport | null>(null);
  const [deletePreviewNames, setDeletePreviewNames] = useState<string[]>([]);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const loadHistory = useCallback(async (): Promise<void> => {
    if (!appUser) return;
    try {
      const conditions = [where("agencyId", "==", appUser.agencyId)];
      if (type) conditions.push(where("type", "==", type));
      const q = query(
        collection(db, "csv_imports"),
        ...conditions,
      );

      const snaps = await getDocs(q);
      const items = snaps.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<CsvImport, "id">),
      }));
      items.sort((a, b) => {
        const dateA = toDate(a.importedAt)?.getTime() ?? 0;
        const dateB = toDate(b.importedAt)?.getTime() ?? 0;
        return dateB - dateA;
      });
      setHistory(items.slice(0, 20));
    } catch (err) {
      console.error("Failed to load import history:", err);
    }
  }, [appUser, type]);

  useEffect(() => {
    setLoading(true);
    loadHistory().finally(() => setLoading(false));
  }, [loadHistory, version]);

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
      await callable({ importId: deleteTarget.id });
      toast({
        title: "Import removed",
        description: `${deleteTarget.recordCount} record(s) and the import history entry were deleted.`,
      });
      setDeleteTarget(null);
      setDeletePreviewNames([]);
      await Promise.all([loadHistory(), onDeleteSuccess()]);
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
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <>
      <Card>
        <h2 className="text-sm sm:text-lg font-bold">Import History</h2>
        {loading ? (
          <p className="mt-3 text-xs sm:text-sm text-[var(--muted-foreground)]">
            Loading...
          </p>
        ) : history.length === 0 ? (
          <p className="mt-3 text-xs sm:text-sm text-[var(--muted-foreground)]">
            No imports yet.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {history.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center rounded-xl border border-[var(--border)] bg-[color:rgba(31,79,138,0.04)] px-3 py-2"
              >
                <button
                  type="button"
                  aria-label={`Remove ${entry.fileName}`}
                  disabled={deleteTarget?.id === entry.id && deleteLoading}
                  onClick={() => onDeleteClick(entry)}
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-red-300 text-red-500 opacity-80 transition hover:bg-red-500 hover:text-white hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ×
                </button>
                {entry.fileUrl ? (
                  <a
                    href={entry.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-1.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-blue-300 text-blue-500 transition hover:bg-blue-500 hover:text-white"
                    aria-label="Download CSV"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                ) : null}
                <div className="ml-2 min-w-0 flex-1">
                  <p className="truncate text-xs sm:text-sm font-medium text-[var(--foreground)]">
                    {entry.fileName}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {entry.recordCount} record(s) &middot;{" "}
                    {entry.importedByEmail ?? "Unknown"} &middot;{" "}
                    {entry.importedAt
                      ? formatInvitedAt(entry.importedAt)
                      : "Unknown date"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <DialogRoot
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeletePreviewNames([]);
          }
        }}
      >
        <DialogContent onClose={() => setDeleteTarget(null)}>
          <DialogTitle className="text-sm sm:text-lg font-bold">
            Confirm Delete
          </DialogTitle>
          <p className="mt-2 text-xs sm:text-sm text-[var(--muted-foreground)]">
            This will permanently delete the following{" "}
            {deletePreviewNames.length} record(s) and the import history entry.
            This action cannot be undone.
          </p>
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
            <ul
              className={`mt-3 space-y-1 ${deletePreviewNames.length > 15 ? "max-h-[360px] overflow-y-auto" : ""}`}
            >
              {deletePreviewNames.map((name, i) => (
                <li
                  key={i}
                  className="text-xs sm:text-sm font-bold text-[var(--foreground)]"
                >
                  {name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs sm:text-sm text-[var(--muted-foreground)]">
              Unable to load names for this import.
            </p>
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
                  ? "Removing..."
                  : "Confirm"}
            </Button>
          </div>
        </DialogContent>
      </DialogRoot>
    </>
  );
};
