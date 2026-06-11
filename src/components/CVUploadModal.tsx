import { Button, DialogContent, DialogRoot, DialogTitle, ProgressBar } from "./ui";
import { Caption } from "../config/typography";
import type { BulkStaff } from "../types/domain";

export interface CvFile {
  file: File;
  base64: string;
  parsedForename: string;
  parsedSurname: string;
  match: BulkStaff | null;
  error?: "size" | "format";
}

interface CVUploadModalProps {
  cvFiles: CvFile[];
  cvUploading: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: () => void | Promise<void>;
}

export function CVUploadModal({
  cvFiles,
  cvUploading,
  open,
  onOpenChange,
  onUpload,
}: CVUploadModalProps) {
  const matchedCount = cvFiles.filter((file) => file.match && !file.error).length;
  const totalCount = cvFiles.length;
  const unmatchedCount = totalCount - matchedCount;

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-none flex flex-col overflow-hidden max-sm:h-[90vh] max-sm:w-[96vw] sm:h-[85vh] sm:w-[80vw]"
        onClose={() => {
          if (!cvUploading) onOpenChange(false);
        }}
      >
        <DialogTitle className="text-base font-bold sm:text-lg">
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

        <div className="mt-3 min-h-0 flex-1 overflow-auto rounded-xl border border-[var(--border)]">
          <table className="min-w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[color:rgba(0,95,87,0.06)]">
                <th className="px-3 py-2 font-medium text-[var(--foreground)]">CV File</th>
                <th className="px-3 py-2 font-medium text-[var(--foreground)]">Status</th>
                <th className="px-3 py-2 font-medium text-[var(--foreground)]">Title</th>
                <th className="px-3 py-2 font-medium text-[var(--foreground)]">Forename</th>
                <th className="px-3 py-2 font-medium text-[var(--foreground)]">Surname</th>
                <th className="px-3 py-2 font-medium text-[var(--foreground)]">NI Number</th>
              </tr>
            </thead>
            <tbody>
              {cvFiles.map((cv, index) => (
                <tr
                  key={`${cv.file.name}-${index}`}
                  className={`border-b border-[var(--border)] last:border-0 ${cv.error || !cv.match ? "bg-red-50" : ""}`}
                >
                  <td className="px-3 py-2 text-[var(--muted-foreground)]">
                    <span className={cv.error || !cv.match ? "text-red-600" : ""}>
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
                  <td className="px-3 py-2 text-[var(--muted-foreground)]">{cv.match?.Title ?? "-"}</td>
                  <td className="px-3 py-2 text-[var(--muted-foreground)]">{cv.match?.Forename ?? "-"}</td>
                  <td className="px-3 py-2 text-[var(--muted-foreground)]">{cv.match?.Surname ?? "-"}</td>
                  <td className="px-3 py-2 text-[var(--muted-foreground)]">{cv.match?.email ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {cvUploading && (
          <div className="mt-3">
            <ProgressBar value={50} />
            <Caption className="mt-1">Uploading CVs...</Caption>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            disabled={cvUploading || matchedCount === 0}
            onClick={() => void onUpload()}
          >
            {cvUploading ? (
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
  );
}
