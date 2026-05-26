import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

interface PaginationBarProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
  onGoToPage: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const PAGE_SIZES = [25, 50, 75];

export const PaginationBar = ({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  loading,
  onPrev,
  onNext,
  onGoToPage,
  onPageSizeChange,
}: PaginationBarProps) => {
  const [pageInput, setPageInput] = useState("");

  const startItem = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalCount);

  const handlePageInputSubmit = () => {
    const page = parseInt(pageInput, 10);
    if (page >= 1 && page <= totalPages) {
      onGoToPage(page);
      setPageInput("");
    }
  };

  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) pages.push(i);

      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  if (totalCount === 0 && !loading) return null;

  return (
    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onPrev}
          disabled={currentPage <= 1 || loading}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] transition hover:bg-[color:rgba(0,95,87,0.06)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="mx-1 flex items-center gap-0.5">
          {pageNumbers.map((page, idx) =>
            page === "..." ? (
              <span
                key={`ellipsis-${idx}`}
                className="px-1 text-xs text-[var(--muted-foreground)]"
              >
                ...
              </span>
            ) : (
              <button
                key={page}
                type="button"
                onClick={() => onGoToPage(page)}
                disabled={loading}
                className={`inline-flex h-7 min-w-[28px] items-center justify-center rounded-lg px-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  page === currentPage
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "text-[var(--muted-foreground)] hover:bg-[color:rgba(0,95,87,0.06)] hover:text-[var(--foreground)]"
                }`}
              >
                {page}
              </button>
            ),
          )}
        </div>

        <button
          type="button"
          onClick={onNext}
          disabled={currentPage >= totalPages || loading}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] transition hover:bg-[color:rgba(0,95,87,0.06)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        <div className="ml-2 flex items-center gap-1">
          <input
            type="text"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter") handlePageInputSubmit();
            }}
            placeholder="Page #"
            className="w-16 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-2 py-1 text-xs text-[var(--foreground)] outline-none transition focus:border-[var(--primary)]"
          />
          <button
            type="button"
            onClick={handlePageInputSubmit}
            disabled={loading || !pageInput}
            className="inline-flex h-7 items-center rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 text-xs font-medium text-[var(--muted-foreground)] transition hover:bg-[color:rgba(0,95,87,0.06)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Go
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-[var(--muted-foreground)]">
          {startItem}–{endItem} of {totalCount}
        </span>

        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="h-7 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-2 text-xs text-[var(--foreground)] outline-none transition focus:border-[var(--primary)]"
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
