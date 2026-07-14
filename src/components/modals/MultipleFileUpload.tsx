import { type ReactNode } from "react";
import {
  Button,
  DialogContent,
  DialogRoot,
  DialogTitle,
} from "../ui";

export interface ColumnDef<T> {
  header: string;
  cell: (item: T, index: number) => ReactNode;
}

export interface SummaryItemBase {
  label: string;
  count: number;
  className: string;
}

export interface SummaryDivider {
  type: "divider";
}

export type SummaryItem = SummaryItemBase | SummaryDivider;

interface MultipleFileUploadModalProps<T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  itemLabel: string;
  files: T[];
  columns: ColumnDef<T>[];
  summaryItems: SummaryItem[];
  uploadableCount: number;
  getFileName: (item: T) => string;
  isError: (item: T) => boolean;
  onUpload: () => void;
  displayTotal?: number;
}

export function MultipleFileUploadModal<T>({
  open,
  onOpenChange,
  title,
  itemLabel,
  files,
  columns,
  summaryItems,
  uploadableCount,
  getFileName,
  isError,
  onUpload,
  displayTotal: displayTotalProp,
}: MultipleFileUploadModalProps<T>) {
  const totalCount = displayTotalProp ?? files.length;

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-none flex flex-col overflow-hidden max-sm:h-[90vh] max-sm:w-[96vw] sm:h-[85vh] sm:w-[80vw]"
        onClose={() => onOpenChange(false)}
      >
        <DialogTitle className="text-base font-bold sm:text-lg">
          {title}
        </DialogTitle>

        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm font-semibold">
            {totalCount} {itemLabel}
            {totalCount !== 1 ? "s" : ""}
            {summaryItems.map((s, i) => {
              if ("type" in s) {
                return (
                  <span key={`divider-${i}`} className="mx-1.5 text-zinc-300 select-none">|</span>
                );
              }
              return (
                <span key={s.label}>
                  {" | "}
                  <span className={s.className}>
                    {s.count} {s.label}
                  </span>
                </span>
              );
            })}
          </span>
        </div>

        <div className="mt-3 min-h-0 flex-1 overflow-auto rounded-xl border border-[var(--border)]">
          <table className="min-w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[color:rgba(0,95,87,0.06)]">
                {columns.map((col) => (
                  <th
                    key={col.header}
                    className="px-3 py-2 font-medium text-[var(--foreground)]"
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {files.map((item, index) => (
                <tr
                  key={`${getFileName(item)}-${index}`}
                  className={`border-b border-[var(--border)] last:border-0 ${
                    isError(item) ? "bg-red-50" : ""
                  }`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.header}
                      className="px-3 py-2 text-[var(--muted-foreground)]"
                    >
                      {col.cell(item, index)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            disabled={uploadableCount === 0}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log("[MultipleFileUploadModal] button onClick fired, uploadableCount:", uploadableCount);
              onUpload();
            }}
          >
            {`Upload ${uploadableCount} ${itemLabel}${uploadableCount !== 1 ? "s" : ""}`}
          </Button>
        </div>
      </DialogContent>
    </DialogRoot>
  );
}
