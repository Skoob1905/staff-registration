import { useEffect, useMemo, useRef, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { Upload } from "lucide-react";
import { Button } from "./ui";
import { ClientsDropdown } from "./ClientsDropdown";
import { DialogContent, DialogRoot, DialogTitle } from "./ui/dialog";
import { useAuth } from "../context/AuthProvider";
import { useToast } from "../context/ToastProvider";
import { functions, storage } from "../services/firebase";
import { useFileStaffStore } from "../stores/fileStaffStore";
import { useAppStore } from "../stores/appStore";

type CsvRow = Record<string, string>;

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

interface AddModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cloudFunction: string;
  storagePath: string;
  itemLabel: string;
  itemLabelPlural: string;
  csvType?: string;
  duplicateKey: string;
  existingKeys: Set<string>;
  onSuccess: () => Promise<void>;
  clients?: { id: string; name: string }[];
  confirmText?: (additions: number) => string;
}

export const AddModal = ({
  open,
  onOpenChange,
  cloudFunction,
  storagePath,
  itemLabel,
  itemLabelPlural,
  duplicateKey,
  existingKeys,
  csvType,
  onSuccess,
  confirmText,
}: AddModalProps) => {
  const { appUser } = useAuth();
  const { toast } = useToast();
  const clients = useAppStore((s) => s.clients);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvData, setCsvData] = useState<{
    headers: string[];
    rows: CsvRow[];
    fileName: string;
    rawFile: File;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [autoAssign, setAutoAssign] = useState(false);
  const [selectedClient, setSelectedClient] = useState("");

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast({
        title: "Invalid file",
        description: "Please upload a CSV file.",
        variant: "error",
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      const parsed = parseCsv(text);
      if (!parsed.headers.length) {
        toast({
          title: "Empty CSV",
          description: "The CSV file has no headers.",
          variant: "error",
        });
        return;
      }
      if (!parsed.rows.length) {
        toast({
          title: "Empty CSV",
          description:
            "The CSV has headers but no data rows. Add data and try again.",
          variant: "error",
        });
        return;
      }

      if (csvType === "staff") {
        const headersLower = parsed.headers.map((h) => h.toLowerCase().trim());
        if (!headersLower.includes("ni number")) {
          toast({
            title: "Invalid staff file",
            description:
              "The CSV must contain an 'NI Number' column.",
            variant: "error",
          });
          return;
        }
      }

      if (csvType === "agency") {
        const headersLower = parsed.headers.map((h) => h.toLowerCase().trim());
        if (!headersLower.includes("business_name")) {
          toast({
            title: "Invalid client file",
            description: "The CSV must contain a 'business_name' column.",
            variant: "error",
          });
          return;
        }
      }

      setCsvData({ ...parsed, fileName: file.name, rawFile: file });
    };
    reader.readAsText(file);
  };

  const onUpload = async () => {
    if (!csvData || !appUser) return;
    setLoading(true);
    setUploadProgress(0);
    try {
      const path = `${storagePath}/${appUser.agencyId}/${Date.now()}-${csvData.fileName}`;
      const storageRef = ref(storage, path);
      const task = uploadBytesResumable(storageRef, csvData.rawFile);
      task.on("state_changed", (snapshot) => {
        const pct = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
        );
        setUploadProgress(pct);
      });
      await task;
      const fileUrl = await getDownloadURL(storageRef);

      const recordsToSend = uniqueRows ?? csvData.rows;

      const callable = httpsCallable(functions, cloudFunction);
      const selectedCompany =
        autoAssign && selectedClient
          ? clients.find((c) => c.id === selectedClient)
          : null;
      const result = await callable({
        records: recordsToSend,
        totalRecords: csvData.rows.length,
        fileName: csvData.fileName,
        fileUrl,
        ...(selectedCompany
          ? {
              assignedToId: selectedCompany.id,
              assignedToName:
                (selectedCompany.business_name as string) ||
                (selectedCompany.name as string) ||
                (selectedCompany.Company_Name as string) ||
                (selectedCompany.company_name as string) ||
                (selectedCompany.agencyName as string) ||
                "Unknown",
            }
          : {}),
      });
      const data = result.data as {
        added: number;
        duplicates: number;
        importId?: string;
      };

      if (data.importId && recordsToSend.length > 0) {
        useFileStaffStore.getState().setFileStaff(data.importId, {
          importId: data.importId,
          fileName: csvData.fileName,
          recordCount: recordsToSend.length,
          staff: recordsToSend,
        });
      }

      const dupMsg =
        data.duplicates > 0
          ? ` with ${data.duplicates} duplicate${data.duplicates === 1 ? "" : "s"}`
          : "";

      toast({
        title: "File uploaded",
        description: `${data.added} ${data.added === 1 ? itemLabel : itemLabelPlural} added${dupMsg}.`,
      });
      setCsvData(null);
      setUploadProgress(0);
      onOpenChange(false);
      if (fileInputRef.current) fileInputRef.current.value = "";

      await onSuccess();
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof (error as { message?: string }).message === "string"
          ? (error as { message: string }).message
          : "Upload failed. Please try again.";
      toast({
        title: "Upload failed",
        description: message,
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const uniqueRows = useMemo(() => {
    if (!csvData) return null;
    return csvData.rows.filter((row) => {
      const key = (row[duplicateKey] || "").toLowerCase().trim();
      return !(key && existingKeys.has(key));
    });
  }, [csvData, existingKeys, duplicateKey]);

  const csvDupInfo = useMemo(() => {
    if (!csvData) return { additions: 0, duplicates: 0 };
    const additions = uniqueRows?.length ?? 0;
    return {
      additions,
      duplicates: csvData.rows.length - additions,
    };
  }, [csvData, uniqueRows]);

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onClose={() => {
          onOpenChange(false);
          setCsvData(null);
          setUploadProgress(0);
          setAutoAssign(false);
          setSelectedClient("");
          if (fileInputRef.current) fileInputRef.current.value = "";
        }}
        className={`max-w-none flex flex-col overflow-hidden ${
          csvData
            ? "max-sm:w-[90vw] max-sm:h-[80vh] sm:w-[80vw] sm:h-[60vh]"
            : "max-sm:w-[95vw] sm:max-w-lg"
        }`}
      >
        <DialogTitle className="text-sm sm:text-lg font-bold">Bulk Upload</DialogTitle>

        {!csvData ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFile(e.dataTransfer.files[0]);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 transition ${
              dragOver
                ? "border-[var(--primary)] bg-[color:rgba(31,79,138,0.06)]"
                : "border-[var(--border)] hover:border-[var(--primary)] hover:bg-[color:rgba(31,79,138,0.04)]"
            }`}
          >
            <Upload className="h-6 w-6 text-[var(--muted-foreground)]" />
            <p className="text-xs sm:text-sm font-medium text-[var(--foreground)]">
              Drop your CSV here or click to browse
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">
              Only .csv files are accepted
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>
        ) : null}

        {csvData ? (
          <div className="mt-4 flex flex-1 min-h-0 flex-col">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">{csvData.fileName}</h3>
              <span className="text-xs sm:text-sm text-[var(--muted-foreground)]">
                {uniqueRows?.length ?? 0} {itemLabelPlural} |{" "}
                {csvDupInfo.duplicates} duplicate
                {csvDupInfo.duplicates !== 1 ? "s" : ""} skipped
              </span>
            </div>

            <div className="mt-2 flex-1 min-h-0 overflow-auto rounded-xl border border-[var(--border)]">
              <table className="min-w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[color:rgba(31,79,138,0.06)]">
                    {csvData.headers.map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 font-medium text-[var(--foreground)]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(uniqueRows ?? csvData.rows).map((row, i) => (
                    <tr
                      key={i}
                      className="border-b border-[var(--border)] last:border-0"
                    >
                      {csvData.headers.map((h) => (
                        <td
                          key={h}
                          className="px-3 py-2 text-[var(--muted-foreground)]"
                        >
                          {row[h]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {loading && uploadProgress > 0 ? (
              <div className="mt-3">
                <div className="h-2 w-full rounded-full bg-[color:rgba(31,79,138,0.15)]">
                  <div
                    className="h-2 rounded-full bg-[var(--primary)] transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  Uploading... {uploadProgress}%
                </p>
              </div>
            ) : null}

            <div className="mt-4 flex items-center justify-end gap-2">
              {csvType === "staff" ? (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="auto-assign"
                    checked={autoAssign}
                    onChange={(e) => {
                      setAutoAssign(e.target.checked);
                      if (!e.target.checked) setSelectedClient("");
                    }}
                    className="h-4 w-4"
                  />
                  <label
                    htmlFor="auto-assign"
                    className="text-xs sm:text-sm text-[var(--foreground)]"
                  >
                    Auto-assign
                  </label>
                  <ClientsDropdown
                    disabled={!autoAssign}
                    value={selectedClient}
                    onChange={setSelectedClient}
                    className="h-8 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-2 text-xs text-[var(--foreground)] outline-none transition focus:border-[var(--primary)] disabled:opacity-50"
                  />
                </div>
              ) : null}
              <Button
                type="button"
                disabled={loading}
                onClick={() => void onUpload()}
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Importing...
                  </span>
                ) : confirmText ? (
                  confirmText(csvDupInfo.additions)
                ) : (
                  `Import ${csvDupInfo.additions} record(s)`
                )}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </DialogRoot>
  );
};
