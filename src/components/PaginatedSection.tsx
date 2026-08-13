import { type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { AccordionRoot } from "./ui";
import { PaginationBar } from "./PaginationBar";
import { Muted } from "../config/typography";

interface PaginatedSectionProps<T> {
  title: string;
  items: T[];
  loading: boolean;
  renderItem: (item: T, index: number) => ReactNode;
  action?: ReactNode;

  page: number;
  totalPages: number;
  totalResults: number;
  pageSize: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onGoToPage: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export const PaginatedSection = <T,>({
  title,
  items,
  loading,
  renderItem,
  action,

  page,
  totalPages,
  totalResults,
  pageSize,
  onPrevPage,
  onNextPage,
  onGoToPage,
  onPageSizeChange,
}: PaginatedSectionProps<T>) => (
  <div>
    <div className="flex items-center justify-between px-4">
      <h2 className="text-base sm:text-lg font-bold text-[var(--foreground)]">
        {title} ({totalResults})
      </h2>
      {action}
    </div>

    <div className="mt-1.5 sm:mt-3">
      {loading && items.length === 0 ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
        </div>
      ) : items.length === 0 ? (
        <Muted className="px-4">Add some {title.toLowerCase()} now!</Muted>
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden border-y border-[var(--border)]">
            <AccordionRoot type="single" collapsible>
              {items.map((item, idx) => renderItem(item, idx))}
            </AccordionRoot>
          </div>
          <div className="px-4">
            <PaginationBar
              currentPage={page + 1}
              totalPages={totalPages}
              totalCount={totalResults}
              pageSize={pageSize}
              loading={loading}
              onPrev={onPrevPage}
              onNext={onNextPage}
              onGoToPage={(p) => onGoToPage(p - 1)}
              onPageSizeChange={onPageSizeChange}
            />
          </div>
        </div>
      )}
    </div>
  </div>
);
