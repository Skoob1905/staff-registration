import { useEffect, useState } from "react";
import { Button, DialogContent, DialogRoot, DialogTitle, Label, ProgressBar } from "./ui";
import { ClientsDropdown } from "./ClientsDropdown";
import { useAuth } from "../context/AuthProvider";
import { useToast } from "../context/ToastProvider";
import { uploadInvoice } from "../services/invoiceService";
import { H1 } from "../config/typography";

interface PreviewModalProps {
  open: boolean;
  file: File | null;
  onClose: () => void;
}

export const PreviewModal = ({ open, file, onClose }: PreviewModalProps) => {
  const { appUser } = useAuth();
  const { toast } = useToast();
  const isAdmin = appUser?.role === "admin";

  const [downloadedFileUrl, setDownloadedFileUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [amountPayable, setAmountPayable] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedClientName, setSelectedClientName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const targetClientId = isAdmin ? selectedClientId : (appUser?.agencyId ?? "");
  const targetClientName = isAdmin ? selectedClientName : "";

  const canSubmit = dueDate.trim() && amountPayable.trim() && targetClientId;

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
      setProgress(0);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [open]);

  const handleUpload = async () => {
    if (!canSubmit || uploading || !file || !targetClientId) return;

    if (new Date(dueDate) <= new Date()) {
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
      await uploadInvoice(
        file,
        targetClientId,
        dueDate,
        amountPayable,
        targetClientName,
        setProgress,
      );

      toast({
        title: "Upload Complete",
        description: `Invoice has been sent to ${targetClientName || targetClientId}`,
        variant: "success",
      });

      onClose();
    } catch {
      toast({
        title: "Upload failed",
        description: "The invoice could not be uploaded. Please try again.",
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
        className="max-w-lg"
      >
        <DialogTitle asChild>
          <H1>Invoice Preview</H1>
        </DialogTitle>

        {file ? (
          <div className="mt-3">
            <p className="mb-2 text-xs text-zinc-500">{file.name}</p>
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
            <p className="text-sm text-zinc-600">Uploading invoice...</p>
            <ProgressBar value={progress} />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
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

            {isAdmin && (
              <div className="space-y-1">
                <Label>Agency</Label>
                <ClientsDropdown
                  value={selectedClientId}
                  onChange={(id, name) => {
                    setSelectedClientId(id);
                    setSelectedClientName(name);
                  }}
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                />
              </div>
            )}

            <Button
              type="button"
              disabled={!canSubmit}
              onClick={handleUpload}
              className="w-full"
            >
              Upload Invoice
            </Button>
          </div>
        )}
      </DialogContent>
    </DialogRoot>
  );
};
