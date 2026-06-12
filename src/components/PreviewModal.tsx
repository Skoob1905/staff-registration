import { useEffect, useState } from "react";
import { Button, DialogContent, DialogRoot, DialogTitle, Label, ProgressBar } from "./ui";
import { ClientsDropdown } from "./ClientsDropdown";
import { useAuth } from "../context/AuthProvider";
import { useToast } from "../context/ToastProvider";
import { uploadInvoice } from "../services/invoiceService";
import { uploadClientContract } from "../services/contractService";
import { functions } from "../services/firebase";
import { H1 } from "../config/typography";
import { httpsCallable } from "firebase/functions";

interface PreviewModalProps {
  open: boolean;
  file: File | null;
  onClose: () => void;
  mode?: "invoice" | "contract" | "timesheet";
}

export const PreviewModal = ({ open, file, onClose, mode = "invoice" }: PreviewModalProps) => {
  const { appUser } = useAuth();
  const { toast } = useToast();
  const isAdmin = appUser?.role === "admin";
  const isContract = mode === "contract";
  const isTimesheet = mode === "timesheet";

  const [downloadedFileUrl, setDownloadedFileUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [amountPayable, setAmountPayable] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedClientName, setSelectedClientName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [csvData, setCsvData] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null);
  const [loadingCsv, setLoadingCsv] = useState(false);

  const targetClientId = isAdmin ? selectedClientId : (appUser?.agencyId ?? "");
  const targetClientName = isAdmin ? selectedClientName : "";

  const canSubmit = isTimesheet
    ? true
    : isContract
    ? !!targetClientId
    : dueDate.trim() && amountPayable.trim() && targetClientId;

  useEffect(() => {
    if (!open || !file) return;

    let alive = true;
    let objectUrl: string | null = null;

    const loadPreview = async () => {
      setLoadingPreview(true);
      try {
        objectUrl = URL.createObjectURL(file);
        if (alive) setDownloadedFileUrl(objectUrl);
      } finally {
        if (alive) setLoadingPreview(false);
      }
    };

    void loadPreview();

    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setDownloadedFileUrl(null);
    };
  }, [open, file]);

  useEffect(() => {
    if (!open || !file || !isTimesheet) return;

    let alive = true;

    const loadCsv = async () => {
      setLoadingCsv(true);
      try {
        const text = await file.text();
        const lines = text.trim().split("\n");
        if (lines.length < 2) return;

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

        const rows: Record<string, string>[] = [];
        for (let i = 1; i < lines.length; i++) {
          const values = parseLine(lines[i]);
          if (values.length === 1 && values[0] === "") continue;
          const row: Record<string, string> = {};
          headerIndices.forEach((rawIdx, mappedIdx) => {
            row[headers[mappedIdx]] = values[rawIdx] ?? "";
          });
          rows.push(row);
        }

        if (alive) setCsvData({ headers, rows });
      } finally {
        if (alive) setLoadingCsv(false);
      }
    };

    void loadCsv();

    return () => {
      alive = false;
    };
  }, [open, file, isTimesheet]);

  useEffect(() => {
    if (!open) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setDueDate("");
      setAmountPayable("");
      setSelectedClientId("");
      setSelectedClientName("");
      setProgress(0);
      setCsvData(null);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [open]);

  const handleUpload = async () => {
    if (!canSubmit || uploading || !file) return;

    if (isTimesheet) {
      setUploading(true);
      setProgress(0);

      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const fn = httpsCallable<
          { fileBase64: string; fileName: string; clientId: string; contentType: string },
          { ok: boolean; url: string }
        >(functions, "recordTimesheetUpload");

        await fn({
          fileBase64: base64,
          fileName: file.name,
          clientId: appUser?.agencyId ?? "",
          contentType: file.type,
        });

        toast({
          title: "Timesheet uploaded",
          description: "Your timesheet has been uploaded successfully.",
          variant: "success",
        });

        onClose();
      } catch (err) {
        const code = (err as { code?: string })?.code;
        if (code === "already-exists" || code === "functions/already-exists") {
          toast({
            title: "Duplicate timesheet",
            description: `A timesheet named "${file.name}" has already been uploaded.`,
            variant: "error",
          });
        } else {
          toast({
            title: "Upload failed",
            description: `"${file.name}" could not be uploaded. Please try again.`,
            variant: "error",
          });
        }
      } finally {
        setUploading(false);
      }
      return;
    }

    if (!targetClientId) return;

    if (!isContract && new Date(dueDate) <= new Date()) {
      toast({
        title: "Invalid due date",
        description: "The due date must be a date in the future.",
        variant: "error",
      });
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      if (isContract) {
        await uploadClientContract(file, targetClientId);
      } else {
        await uploadInvoice(
          file,
          targetClientId,
          dueDate,
          amountPayable,
          targetClientName,
          setProgress,
        );
      }

      toast({
        title: "Upload Complete",
        description: isContract
          ? `Contract has been uploaded for ${targetClientName || targetClientId}`
          : `Invoice has been sent to ${targetClientName || targetClientId}`,
        variant: "success",
      });

      onClose();
    } catch {
      toast({
        title: "Upload failed",
        description: isContract
          ? "The contract could not be uploaded. Please try again."
          : "The invoice could not be uploaded. Please try again.",
        variant: "error",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <DialogRoot open={open} onOpenChange={(next) => (!next ? onClose() : null)}>
      <DialogContent
        onClose={onClose}
        closeDisabled={uploading}
        className={isTimesheet ? "max-w-2xl" : "max-w-lg"}
      >
        <DialogTitle asChild>
          <H1>{isTimesheet ? "Timesheet Preview" : isContract ? "Contract Preview" : "Invoice Preview"}</H1>
        </DialogTitle>

        {file ? (
          <div className="mt-3">
            <p className="mb-2 text-sm font-semibold text-[var(--foreground)]">{file.name}</p>
            {isTimesheet ? (
              loadingCsv ? (
                <div className="flex h-[320px] items-center justify-center text-sm text-zinc-500 rounded-xl border border-[var(--border)] bg-white">
                  Loading preview...
                </div>
              ) : csvData ? (
                <div className="max-h-[320px] overflow-auto rounded-xl border border-[var(--border)]">
                  <table className="min-w-full text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[color:rgba(0,95,87,0.06)]">
                        {csvData.headers.map((h) => (
                          <th key={h} className="px-3 py-2 font-medium text-[var(--foreground)]">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvData.rows.map((row, i) => (
                        <tr key={i} className="border-b border-[var(--border)] last:border-0">
                          {csvData.headers.map((h) => (
                            <td key={h} className="px-3 py-2 text-[var(--muted-foreground)]">
                              {row[h]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null
            ) : (
              <div className="h-[320px] overflow-hidden rounded-xl border border-[var(--border)] bg-white">
                {loadingPreview ? (
                  <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                    Loading preview...
                  </div>
                ) : (
                  <iframe
                    title={`Preview ${file.name}`}
                    src={downloadedFileUrl ?? ""}
                    className="h-full w-full"
                  />
                )}
              </div>
            )}
          </div>
        ) : null}

        {uploading ? (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-zinc-600">
              {isTimesheet ? "Uploading timesheet..." : isContract ? "Uploading contract..." : "Uploading invoice..."}
            </p>
            <ProgressBar value={progress} />
          </div>
        ) : (
          <div className={isTimesheet ? "mt-4 flex justify-end" : "mt-4 space-y-3"}>
            {!isContract && !isTimesheet && (
              <>
                <div className="space-y-1">
                  <Label>Due Date</Label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Amount Payable (£)</Label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={amountPayable}
                    onChange={(e) => setAmountPayable(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                  />
                </div>
              </>
            )}

            {isAdmin && !isTimesheet && (
              <div className="space-y-1">
                <Label>Agency</Label>
                <ClientsDropdown
                  value={selectedClientId}
                  onChange={(id, name) => {
                    setSelectedClientId(id);
                    setSelectedClientName(name);
                  }}
                  disableWithContract
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                />
              </div>
            )}

            <Button
              type="button"
              disabled={!canSubmit}
              onClick={handleUpload}
            >
              {isTimesheet ? "Upload Timesheet" : isContract ? "Upload Contract" : "Upload Invoice"}
            </Button>
          </div>
        )}
      </DialogContent>
    </DialogRoot>
  );
};
