import { useState, useRef, useCallback, useMemo } from "react";
import { httpsCallable } from "firebase/functions";
import { Upload, FileText, X, AlertCircle, CheckCircle } from "lucide-react";
import { Button, DialogContent, DialogRoot, DialogTitle, ProgressBar } from "./ui";
import { BodyMedium, Caption } from "../config/typography";
import { functions } from "../services/firebase";
import { useToast } from "../context/ToastProvider";
import type { BulkStaff } from "../types/domain";
import { readCvFile, type CvFile } from "../utils/cvUpload";

interface StaffCvUploadProps {
  staffList: BulkStaff[];
  staffLoading: boolean;
  onSuccess: () => void;
}

export const StaffCvUpload = ({
  staffList,
  staffLoading: _staffLoading,
  onSuccess,
}: StaffCvUploadProps) => {
  const { toast } = useToast();
  const [cvFiles, setCvFiles] = useState<CvFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const matched = useMemo(() => cvFiles.filter((f) => f.match && !f.error), [cvFiles]);
  const unmatched = useMemo(
    () => cvFiles.filter((f) => !f.match || f.error),
    [cvFiles],
  );

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const results = await Promise.all(
        fileArray.map((file) => readCvFile(file, staffList)),
      );
      setCvFiles((prev) => [...prev, ...results]);
    },
    [staffList],
  );

  const removeFile = useCallback((index: number) => {
    setCvFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpload = useCallback(async () => {
    const valid = matched.filter((f) => f.base64);
    if (valid.length === 0) return;

    setUploading(true);
    setUploadProgress(10);

    try {
      const fn = httpsCallable(functions, "uploadStaffCvs");
      await fn({
        cvs: valid.map((f) => ({
          staffId: f.match!.id,
          fileName: f.file.name,
          fileBase64: f.base64,
        })),
      });
      setUploadProgress(100);
      toast({
        title: "CVs uploaded",
        description: `${valid.length} CV(s) uploaded successfully`,
        variant: "success",
      });
      setCvFiles([]);
      setShowReview(false);
      onSuccess();
    } catch {
      toast({
        title: "Upload failed",
        description: "Failed to upload CVs. Please try again.",
        variant: "error",
      });
    } finally {
      setUploading(false);
    }
  }, [matched, toast, onSuccess]);

  const totalCount = cvFiles.length;
  const matchedCount = matched.length;
  const unmatchedCount = unmatched.length;

  return (
    <>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 transition ${
          dragOver
            ? "border-[var(--primary)] bg-[color:rgba(0,95,87,0.06)]"
            : "border-[var(--border)] hover:border-[var(--primary)] hover:bg-[color:rgba(0,95,87,0.04)]"
        }`}
      >
        <Upload className="h-6 w-6 text-[var(--muted-foreground)]" />
        <BodyMedium>Drop CV PDFs here or click to browse</BodyMedium>
        <Caption>PDF files only, max 2MB each</Caption>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void handleFiles(e.target.files);
          }}
        />
      </div>

      {cvFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">
              {totalCount} CV{totalCount !== 1 ? "s" : ""}
              {" | "}
              <span className="text-[var(--primary)]">{matchedCount} Matched</span>
              {" | "}
              <span className="text-red-600">{unmatchedCount} Unmatched</span>
            </span>
            <Button
              type="button"
              onClick={() => setShowReview(true)}
              disabled={matchedCount === 0}
            >
              Upload {matchedCount} CV{matchedCount !== 1 ? "s" : ""}
            </Button>
          </div>

          <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-[var(--border)] p-2">
            {cvFiles.map((cv, i) => (
              <div
                key={i}
                className={`flex items-center justify-between rounded-lg px-2 py-1 text-xs sm:text-sm ${
                  cv.error || !cv.match
                    ? "bg-red-50 text-red-700"
                    : "bg-[color:rgba(0,95,87,0.06)] text-[var(--foreground)]"
                }`}
              >
                <span className="flex items-center gap-1.5 truncate">
                  {cv.error || !cv.match ? (
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                  ) : (
                    <CheckCircle className="h-3.5 w-3.5 shrink-0 text-[var(--primary)]" />
                  )}
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{cv.file.name}</span>
                  {cv.match && (
                    <span className="text-[var(--muted-foreground)]">
                      → {cv.match.Forename} {cv.match.Surname}
                    </span>
                  )}
                  {cv.error === "size" && (
                    <span className="text-red-600">(too large)</span>
                  )}
                  {cv.error === "format" && (
                    <span className="text-red-600">(not PDF)</span>
                  )}
                  {!cv.error && !cv.match && (
                    <span className="text-red-600">(no match)</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(i);
                  }}
                  className="ml-2 shrink-0 text-[var(--muted-foreground)] hover:text-red-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <DialogRoot open={showReview} onOpenChange={setShowReview}>
        <DialogContent
          className="max-sm:w-[90vw] max-sm:h-[80vh] sm:w-[80vw] sm:h-[60vh] flex flex-col overflow-hidden"
          onClose={() => {
            if (!uploading) setShowReview(false);
          }}
        >
          <DialogTitle className="text-base sm:text-lg font-bold">
            Upload CVs
          </DialogTitle>

          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm font-semibold">
              {totalCount} CV{totalCount !== 1 ? "s" : ""}
              {" | "}
              <span className="text-[var(--primary)]">{matchedCount} Matched</span>
              {" | "}
              <span className="text-red-600">{unmatchedCount} Unmatched</span>
            </span>
          </div>

          <div className="mt-3 flex-1 min-h-0 overflow-auto rounded-xl border border-[var(--border)]">
            <table className="min-w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[color:rgba(0,95,87,0.06)]">
                  <th className="px-3 py-2 font-medium text-[var(--foreground)]">
                    CV File
                  </th>
                  <th className="px-3 py-2 font-medium text-[var(--foreground)]">
                    Status
                  </th>
                  <th className="px-3 py-2 font-medium text-[var(--foreground)]">
                    Title
                  </th>
                  <th className="px-3 py-2 font-medium text-[var(--foreground)]">
                    Forename
                  </th>
                  <th className="px-3 py-2 font-medium text-[var(--foreground)]">
                    Surname
                  </th>
                  <th className="px-3 py-2 font-medium text-[var(--foreground)]">
                    NI Number
                  </th>
                </tr>
              </thead>
              <tbody>
                {cvFiles.map((cv, i) => (
                  <tr
                    key={i}
                    className={`border-b border-[var(--border)] last:border-0 ${
                      cv.error || !cv.match ? "bg-red-50" : ""
                    }`}
                  >
                    <td className="px-3 py-2 text-[var(--muted-foreground)]">
                      <span
                        className={
                          cv.error || !cv.match ? "text-red-600" : ""
                        }
                      >
                        {cv.file.name}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {cv.match ? (
                        <span className="text-[var(--primary)]">Matched</span>
                      ) : cv.error === "size" ? (
                        <span className="text-red-600">Too large</span>
                      ) : cv.error === "format" ? (
                        <span className="text-red-600">Not PDF</span>
                      ) : (
                        <span className="text-red-600">No match</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[var(--muted-foreground)]">
                      {cv.match?.Title ?? "-"}
                    </td>
                    <td className="px-3 py-2 text-[var(--muted-foreground)]">
                      {cv.match?.Forename ?? "-"}
                    </td>
                    <td className="px-3 py-2 text-[var(--muted-foreground)]">
                      {cv.match?.Surname ?? "-"}
                    </td>
                    <td className="px-3 py-2 text-[var(--muted-foreground)]">
                      {cv.match?.email ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {uploading && (
            <div className="mt-3">
              <ProgressBar value={uploadProgress} />
              <Caption className="mt-1">Uploading CVs...</Caption>
            </div>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              disabled={uploading}
              onClick={() => setShowReview(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={uploading || matchedCount === 0}
              onClick={() => void handleUpload()}
            >
              {uploading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Importing...
                </span>
              ) : (
                `Import ${matchedCount} CV${matchedCount !== 1 ? "s" : ""}`
              )}
            </Button>
          </div>
        </DialogContent>
      </DialogRoot>
    </>
  );
};
