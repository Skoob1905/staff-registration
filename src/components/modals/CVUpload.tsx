import { MultipleFileUploadModal, type ColumnDef, type SummaryItem } from "./MultipleFileUpload";
import type { CvFile } from "../../types/domain";

const columns: ColumnDef<CvFile>[] = [
  {
    header: "CV File",
    cell: (cv) => (
      <span className={cv.error || !cv.match ? "text-red-600" : ""}>
        {cv.file.name}
      </span>
    ),
  },
  {
    header: "Status",
    cell: (cv) => {
      if (cv.match) return <span className="text-[var(--primary)]">Matched</span>;
      if (cv.error === "size") return <span className="text-red-600">Too large</span>;
      if (cv.error === "format") return <span className="text-red-600">Not PDF</span>;
      return <span className="text-red-600">No match</span>;
    },
  },
  { header: "Title", cell: (cv) => cv.match?.Title ?? "-" },
  { header: "Forename", cell: (cv) => cv.match?.Forename ?? "-" },
  { header: "Surname", cell: (cv) => cv.match?.Surname ?? "-" },
  { header: "NI Number", cell: (cv) => cv.match?.email ?? "-" },
];

interface CVUploadModalProps {
  cvFiles: CvFile[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: () => void;
}

export function CVUploadModal({
  cvFiles,
  open,
  onOpenChange,
  onUpload,
}: CVUploadModalProps) {
  const matchedCount = cvFiles.filter((f) => f.match && !f.error).length;
  const unmatchedCount = cvFiles.length - matchedCount;

  const summaryItems: SummaryItem[] = [
    { label: "Matched", count: matchedCount, className: "text-[var(--primary)]" },
    { label: "Unmatched", count: unmatchedCount, className: "text-red-600" },
  ];

  return (
    <MultipleFileUploadModal
      open={open}
      onOpenChange={onOpenChange}
      title="Upload CVs"
      itemLabel="CV"
      files={cvFiles}
      columns={columns}
      summaryItems={summaryItems}
      uploadableCount={matchedCount}
      getFileName={(f) => f.file.name}
      isError={(f) => !!(f.error || !f.match)}
      onUpload={onUpload}
    />
  );
}
