import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import {
  Button,
  DialogContent,
  DialogRoot,
  DialogTitle,
  Label,
  ProgressBar,
} from "./ui";
import { ClientsDropdown } from "./ClientsDropdown";
import { useAuth } from "../context/AuthProvider";
import { useToast } from "../context/ToastProvider";
import { uploadInvoice } from "../services/invoiceService";
import { uploadClientContract } from "../services/contractService";
import { uploadPayslip } from "../services/payslipService";
import { uploadStaffDocument } from "../services/staffUploadService";
import { db } from "../services/firebase";
import type { BulkStaff } from "../types/domain";
import { H1 } from "../config/typography";

interface PreviewModalProps {
  open: boolean;
  file: File | null;
  onClose: () => void;
  mode?: "invoice" | "contract" | "payslip" | "document";
}

export const PreviewModal = ({
  open,
  file,
  onClose,
  mode = "invoice",
}: PreviewModalProps) => {
  const { appUser } = useAuth();
  const { toast } = useToast();
  const isAdmin = appUser?.role === "admin" || appUser?.role === "super";
  const isContract = mode === "contract";
  const isPayslip = mode === "payslip";
  const isDocument = mode === "document";
  const isStaffUpload = isPayslip || isDocument;

  const [staffList, setStaffList] = useState<BulkStaff[]>([]);

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const snaps = await getDocs(collection(db, "staff"));
        setStaffList(
          snaps.docs.map((d) => ({ ...d.data(), id: d.id }) as BulkStaff),
        );
        console.log({ snaps });
      } catch (err) {
        console.error("Failed to fetch staff for dropdown", err);
      }
    };
    void fetchStaff();
  }, []);

  const [downloadedFileUrl, setDownloadedFileUrl] = useState<string | null>(
    null,
  );
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [amountPayable, setAmountPayable] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedClientName, setSelectedClientName] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const targetClientId = isAdmin ? selectedClientId : (appUser?.agencyId ?? "");
  const targetClientName = isAdmin ? selectedClientName : "";

  const canSubmit = isStaffUpload
    ? !!selectedStaffId
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
    if (!open) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setDueDate("");
      setAmountPayable("");
      setSelectedClientId("");
      setSelectedClientName("");
      setSelectedStaffId("");
      setProgress(0);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [open]);

  const handleUpload = async () => {
    if (!canSubmit || uploading || !file) return;

    if (isStaffUpload) {
      if (!selectedStaffId) return;
    } else if (!targetClientId) return;

    if (!isContract && !isStaffUpload && new Date(dueDate) <= new Date()) {
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
      if (isStaffUpload) {
        const agencyId =
          staffList.find((s) => s.id === selectedStaffId)?.agencyId ??
          appUser?.agencyId ??
          "";
        if (isPayslip) {
          await uploadPayslip(file, selectedStaffId, agencyId);
        } else {
          await uploadStaffDocument(file, selectedStaffId, agencyId, "general");
        }
      } else if (isContract) {
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
        description: isStaffUpload
          ? isPayslip
            ? `Payslip has been uploaded`
            : `Document has been uploaded`
          : isContract
            ? `Contract has been uploaded for ${targetClientName || targetClientId}`
            : `Invoice has been sent to ${targetClientName || targetClientId}`,
        variant: "success",
      });

      onClose();
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "already-exists" || code === "functions/already-exists") {
        toast({
          title: "Duplicate file",
          description: `"${file?.name}" has already been uploaded.`,
          variant: "error",
        });
      } else {
        toast({
          title: "Upload failed",
          description: isStaffUpload
            ? isPayslip
              ? "The payslip could not be uploaded. Please try again."
              : "The document could not be uploaded. Please try again."
            : isContract
              ? "The contract could not be uploaded. Please try again."
              : "The invoice could not be uploaded. Please try again.",
          variant: "error",
        });
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <DialogRoot open={open} onOpenChange={(next) => (!next ? onClose() : null)}>
      <DialogContent
        onClose={onClose}
        closeDisabled={uploading}
        className="max-w-lg"
      >
        <DialogTitle asChild>
          <H1>
            {isPayslip
              ? "Payslip Preview"
              : isDocument
                ? "Document Preview"
                : isContract
                  ? "Contract Preview"
                  : "Invoice Preview"}
          </H1>
        </DialogTitle>

        {file ? (
          <div className="mt-3">
            <p className="mb-2 text-sm font-semibold text-[var(--foreground)]">
              {file.name}
            </p>
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
          </div>
        ) : null}

        {uploading ? (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-zinc-600">
              {isPayslip
                ? "Uploading payslip..."
                : isDocument
                  ? "Uploading document..."
                  : isContract
                    ? "Uploading contract..."
                    : "Uploading invoice..."}
            </p>
            <ProgressBar value={progress} />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {isStaffUpload ? (
              <div className="space-y-1">
                <Label>Staff Member</Label>
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                >
                  <option value="">Select a staff member...</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.FullName ||
                        `${s.Forename ?? ""} ${s.Surname ?? ""}`.trim() ||
                        s.email ||
                        s.id}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <>
                {!isContract && (
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

                {isAdmin && (
                  <div className="space-y-1">
                    <Label>Agency</Label>
                    <ClientsDropdown
                      value={selectedClientId}
                      onChange={(id, name) => {
                        setSelectedClientId(id);
                        setSelectedClientName(name);
                      }}
                      disableWithContract={isContract}
                      className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                    />
                  </div>
                )}
              </>
            )}

            <Button type="button" disabled={!canSubmit} onClick={handleUpload}>
              {isPayslip
                ? "Upload Payslip"
                : isDocument
                  ? "Upload Document"
                  : isContract
                    ? "Upload Contract"
                    : "Upload Invoice"}
            </Button>
          </div>
        )}
      </DialogContent>
    </DialogRoot>
  );
};
