import { useEffect, useMemo, useRef, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { countCollection } from "../services/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { Upload } from "lucide-react";
import { BodyMedium, Caption, Muted } from "../config/typography";
import { AgenciesDropdown } from "./AgenciesDropdown";
import { Button, DialogContent, DialogRoot, DialogTitle } from "./ui";
import { useAuth } from "../context/AuthProvider";
import { useToast } from "../context/ToastProvider";
import { functions, storage } from "../services/firebase";
import { useFileStaffStore } from "../stores/fileStaffStore";
import { useAppStore } from "../stores/appStore";
import {
  hasWorkerRefColumn,
  hasAgencyRefColumn,
  hasClientRefColumn,
} from "../utils/keyHeaderNormalisation";

const ALGOLIA_INDEX_PREFIX = import.meta.env.VITE_ALGOLIA_INDEX_PREFIX ?? "";
const DEV_FILE_SIZE_LIMIT = 102400;
const MAX_STAFF_RECORDS = 500;
const MAX_CLIENT_RECORDS = 100;

type CsvRow = Record<string, string>;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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

  const rawHeaders = parseLine(lines[0]);
  const seen = new Set<string>();
  const headers: string[] = [];
  const headerIndices: number[] = [];
  rawHeaders.forEach((h, idx) => {
    if (!seen.has(h)) {
      seen.add(h);
      headers.push(h);
      headerIndices.push(idx);
    }
  });

  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    if (values.length === 1 && values[0] === "") continue;
    const row: CsvRow = {};
    headerIndices.forEach((rawIdx, mappedIdx) => {
      row[headers[mappedIdx]] = values[rawIdx] ?? "";
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
  onSuccess?: (importId?: string) => Promise<void>;
  clients?: { id: string; name: string }[];
  confirmText?: (additions: number) => string;
  initialFile?: File | null;
}

export const AddModal = ({
  open,
  onOpenChange,
  cloudFunction,
  storagePath,
  itemLabel,
  itemLabelPlural,
  csvType,
  onSuccess,
  confirmText,
  initialFile,
}: AddModalProps) => {
  const { appUser } = useAuth();
  const { toast } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvData, setCsvData] = useState<{
    headers: string[];
    rows: CsvRow[];
    fileName: string;
    rawFile: File;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [selectedAgencyId, setSelectedAgencyId] = useState("");
  const [selectedAgencyName, setSelectedAgencyName] = useState("");

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
    if (
      ALGOLIA_INDEX_PREFIX === "dev_" &&
      file.size > DEV_FILE_SIZE_LIMIT &&
      csvType !== "timesheet"
    ) {
      toast({
        title: "File too large",
        description: "In preview mode, files are limited to 100KB.",
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
        if (!hasWorkerRefColumn(parsed.headers)) {
          console.warn(
            "[AddModal] No Worker Ref column found. Headers:",
            parsed.headers,
          );
          toast({
            title: "No reference column",
            description:
              "CSV missing Ref/Reference/Workers Ref column. Staff IDs will be auto-generated.",
            variant: "error",
          });
          return;
        }
      }

      if (csvType === "agency") {
        if (!hasAgencyRefColumn(parsed.headers)) {
          toast({
            title: "Invalid agency file",
            description:
              "The CSV must contain a Ref or Reference column.",
            variant: "error",
          });
          return;
        }
      }
      if (csvType === "client") {
        if (!hasClientRefColumn(parsed.headers)) {
          toast({
            title: "Invalid client file",
            description:
              "The CSV must contain a Ref or Reference column.",
            variant: "error",
          });
          return;
        }
      }

      setCsvData({ ...parsed, fileName: file.name, rawFile: file });
    };
    reader.readAsText(file);
  };

  const fileProcessedRef = useRef(false);
  const handleFileRef = useRef<(file: File) => void>(() => {});

  useEffect(() => {
    handleFileRef.current = handleFile;
  });

  useEffect(() => {
    if (open && initialFile && !fileProcessedRef.current) {
      fileProcessedRef.current = true;
      handleFileRef.current(initialFile);
    }
    if (!open) {
      fileProcessedRef.current = false;
    }
  }, [open, initialFile]);

  useEffect(() => {
    return () => {
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
    };
  }, [loading, toast]);

  const onUpload = async () => {
    if (!csvData || !appUser) return;
    setLoading(true);
    setUploadProgress(0);
    setProcessing(false);
    try {
      if (csvType === "timesheet") {
        setUploadProgress(50);
        const base64 = await fileToBase64(csvData.rawFile);
        setUploadProgress(80);
        const fn = httpsCallable(functions, "recordTimesheetUpload");
        await fn({
          fileBase64: base64,
          fileName: csvData.fileName,
          clientId: appUser.agencyId ?? "",
          contentType: csvData.rawFile.type,
        });
        setUploadProgress(100);

        toast({
          title: "Timesheet uploaded",
          description: `We have received your timesheet and will process it as soon as possible.`,
          variant: "success",
        });
        setUploadProgress(0);
        setCsvData(null);
        setSelectedAgencyId("");
        setSelectedAgencyName("");
        onOpenChange(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      if (ALGOLIA_INDEX_PREFIX === "dev_") {
        const collectionName =
          csvType === "staff"
            ? "staff"
            : csvType === "agency"
              ? "agencies"
              : "clients";
        const maxRecords =
          csvType === "staff" ? MAX_STAFF_RECORDS : MAX_CLIENT_RECORDS;
        const label =
          csvType === "staff"
            ? "staff"
            : csvType === "agency"
              ? "agencies"
              : "clients";
        const existingCount = await countCollection(collectionName);
        if (existingCount + csvData.rows.length > maxRecords) {
          toast({
            title: "Too Many Records",
            description: `You have ${existingCount} ${label} in the database. Uploading ${csvData.rows.length} more would exceed the ${maxRecords} limit. Please delete some ${label} first.`,
            variant: "error",
          });
          return;
        }
      }

      const path = `${storagePath}/${Date.now()}-${csvData.fileName}`;
      const storageRef = ref(storage, path);
      const task = uploadBytesResumable(storageRef, csvData.rawFile);
      task.on("state_changed", (snapshot) => {
        const raw = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
        );
        setUploadProgress(Math.min(raw, 90));
      });
      await task;
      setProcessing(true);
      const fileUrl = await getDownloadURL(storageRef);

      const recordsToSend = csvData.rows;

      const callable = httpsCallable(functions, cloudFunction);
      const result = await callable({
        records: recordsToSend,
        totalRecords: csvData.rows.length,
        fileName: csvData.fileName,
        fileUrl,
        ...(selectedAgencyId
          ? {
              assignedToId: selectedAgencyId,
              assignedToName: selectedAgencyName,
            }
          : {}),
      });
      setProcessing(false);

      const data = result.data as {
        added: number;
        duplicates: number;
        importId?: string;
        emails: string[];
      };

      if (data.importId && recordsToSend.length > 0) {
        useFileStaffStore.getState().setFileStaff(data.importId, {
          importId: data.importId,
          fileName: csvData.fileName,
          recordCount: recordsToSend.length,
          staff: recordsToSend,
        });
        useAppStore.getState().addImportEntry(csvType, {
          id: data.importId,
          fileName: csvData.fileName,
          fileUrl,
          recordCount: data.added,
          importedByUid: appUser.uid,
          importedByEmail: appUser.email,
          importedAt: new Date(),
          type: csvType,
        });
      }

      toast({
        title: "Import complete",
        description: `${data.added} ${data.added === 1 ? itemLabel : itemLabelPlural} added. Logins will be sent shortly.`,
        variant: "success",
        replaceToast: true,
      });
      setUploadProgress(0);
      setCsvData(null);
      setSelectedAgencyId("");
      setSelectedAgencyName("");
      onOpenChange(false);
      if (fileInputRef.current) fileInputRef.current.value = "";

      try {
        await onSuccess?.(data.importId);
      } catch {
        // onSuccess failure shouldn't block email sending
      }

      if (data.emails.length > 0) {
        const emailCallable = httpsCallable(functions, "sendImportEmails");
        const emailResult = await emailCallable({
          emails: data.emails,
          type:
            csvType === "staff"
              ? "worker"
              : csvType === "agency"
                ? "agency"
                : "client",
        });
        const { sent, failed } = emailResult.data as {
          sent: number;
          failed: number;
        };
        if (failed > 0) {
          toast({
            title: `${failed} email(s) failed`,
            description: `${sent} sent, ${failed} failed.`,
            variant: "error",
          });
        } else {
          toast({
            title: "Emails sent",
            description: `${sent} login email(s) delivered.`,
            variant: "success",
          });
        }
      }
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code;
      if (
        csvType === "timesheet" &&
        (code === "already-exists" || code === "functions/already-exists")
      ) {
        toast({
          title: "Duplicate timesheet",
          description: `A timesheet named "${csvData?.fileName ?? ""}" has already been uploaded.`,
          variant: "error",
        });
      } else {
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
          replaceToast: true,
        });
      }
    } finally {
      setLoading(false);
      setProcessing(false);
    }
  };

  const csvDupInfo = useMemo(() => {
    if (!csvData) return { total: 0 };
    return { total: csvData.rows.length };
  }, [csvData]);

  return (
    <>
      <DialogRoot
        open={open}
        onOpenChange={(o) => {
          if (o !== false || !loading) onOpenChange(o);
        }}
      >
        <DialogContent
          closeDisabled={loading}
          onClose={() => {
            if (loading) return;
            onOpenChange(false);
            setCsvData(null);
            setUploadProgress(0);
            setSelectedAgencyId("");
            setSelectedAgencyName("");
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
          className={`max-w-none flex flex-col overflow-hidden ${
            csvData
              ? "max-sm:w-[90vw] max-sm:h-[80vh] sm:w-[80vw] sm:h-[60vh]"
              : "max-sm:w-[95vw] sm:max-w-lg"
          }`}
        >
          <DialogTitle className="text-base sm:text-lg font-bold">
            {csvType === "timesheet" ? "Timesheet Upload" : "Bulk Upload"}
          </DialogTitle>

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
                  ? "border-[var(--primary)] bg-[color:rgba(0,95,87,0.06)]"
                  : "border-[var(--border)] hover:border-[var(--primary)] hover:bg-[color:rgba(0,95,87,0.04)]"
              }`}
            >
              <Upload className="h-6 w-6 text-[var(--muted-foreground)]" />
              <BodyMedium>Drop your CSV here or click to browse</BodyMedium>
              <Caption>Only .csv files are accepted</Caption>
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
                <Muted as="span">
                  {csvDupInfo.total}{" "}
                  {csvType === "timesheet" ? "records" : itemLabelPlural}
                </Muted>
              </div>

              <div className="mt-2 flex-1 min-h-0 overflow-auto rounded-xl border border-[var(--border)]">
                <table className="min-w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[color:rgba(0,95,87,0.06)]">
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
                    {csvData.rows.map((row, i) => (
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
                  <div className="h-2 w-full rounded-full bg-[color:rgba(0,95,87,0.15)]">
                    <div
                      className="h-2 rounded-full bg-[var(--primary)] transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <Caption className="mt-1">
                    {processing
                      ? "Processing..."
                      : `Uploading... ${uploadProgress}%`}
                  </Caption>
                </div>
              ) : null}

              <div className="mt-4 flex items-center justify-end gap-2">
                <div className="flex items-center gap-2">
                  {csvType === "staff" && (
                    <>
                      <BodyMedium>Auto Assign</BodyMedium>
                      <AgenciesDropdown
                        value={selectedAgencyId}
                        onChange={(value, name) => {
                          setSelectedAgencyId(value);
                          setSelectedAgencyName(name);
                        }}
                        disabled={loading}
                        className="h-9 w-48 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-2 text-xs sm:text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--primary)]"
                        placeholder="Select an agency..."
                      />
                    </>
                  )}
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
                    ) : csvType === "timesheet" ? (
                      "Upload Timesheet"
                    ) : confirmText ? (
                      confirmText(csvDupInfo.total)
                    ) : (
                      `Import ${csvDupInfo.total} record(s)`
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </DialogRoot>

    </>
  );
};
