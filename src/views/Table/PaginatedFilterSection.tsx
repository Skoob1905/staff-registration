import { useMemo, type ReactNode } from "react";
import { Filter, Loader2 } from "lucide-react";
import { AccordionRoot } from "../../components/ui";
import { PaginationBar } from "./PaginationBar";
import { Muted } from "../../config/typography";
import type { StaffFilters, FilterKeyMap } from "../../types/domain";

interface PaginatedFilterSectionProps<T> {
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

  filters: StaffFilters;
  filterKeys?: FilterKeyMap;
  enableNameFilter?: boolean;
  enableTagFilter?: boolean;
  enableAgencyFilter?: boolean;
  enableLoginStatusFilter?: boolean;

  emptyMessage?: string;
  noMatchMessage?: string;

  columnHeaders?: string[];

  accordionType?: "single" | "multiple";
  multiAccordionValue?: string[];
  onMultiAccordionChange?: (value: string[]) => void;

  expandable?: boolean;
}

export const PaginatedFilterSection = <T,>({
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

  filters,
  enableNameFilter = true,
  enableTagFilter = true,
  enableAgencyFilter = false,
  enableLoginStatusFilter = false,

  emptyMessage,
  noMatchMessage = "Oops there are no records with that filter",

  columnHeaders,

  accordionType = "single",
  multiAccordionValue,
  onMultiAccordionChange,

  expandable = true,
}: PaginatedFilterSectionProps<T>) => {
  const hasAnyFilter =
    enableNameFilter || enableTagFilter || enableAgencyFilter || enableLoginStatusFilter;

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (enableNameFilter && filters.name.length >= 3) count++;
    if (enableTagFilter) count += filters.tagIds.length;
    if (enableAgencyFilter) count += filters.agencyIds.length;
    if (filters.loginStatusFilter && filters.loginStatusFilter !== "all") count++;
    return count;
  }, [filters, enableNameFilter, enableTagFilter, enableAgencyFilter]);

  const renderHeaderAction = () => (
    <div className="flex items-center gap-2">
      {hasAnyFilter && (totalResults > 0 || activeFilterCount > 0) && (
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
        >
          <Filter className="h-3.5 w-3.5" />
          Filter
          {activeFilterCount > 0 && (
            <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
      )}
      {action}
    </div>
  );

  const renderItems = () => {
    if (expandable) {
      if (accordionType === "multiple") {
        return (
          <AccordionRoot
            type="multiple"
            value={multiAccordionValue ?? []}
            onValueChange={onMultiAccordionChange ?? (() => {})}
          >
            {items.map((item, idx) => renderItem(item, idx))}
          </AccordionRoot>
        );
      }
      return (
        <AccordionRoot type="single" collapsible>
          {items.map((item, idx) => renderItem(item, idx))}
        </AccordionRoot>
      );
    }

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, idx) => {
            const rendered = renderItem(item, idx);
            return (
              <div
                key={idx}
                className="rounded-2xl border p-3 sm:p-4 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
              >
                {rendered}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      <div>
        <div className="flex items-center justify-between px-4">
          <h2 className="text-base sm:text-lg font-bold text-[var(--foreground)]">
            {title} ({totalResults})
          </h2>
          {renderHeaderAction()}
        </div>

        <div className="mt-1.5 sm:mt-3">
          {loading && items.length === 0 ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
            </div>
          ) : items.length === 0 ? (
            <Muted className="px-4">
              {activeFilterCount > 0
                ? noMatchMessage
                : emptyMessage || `Add some ${title.toLowerCase()} now!`}
            </Muted>
          ) : (
            <div className="space-y-4">
              <div className="border-y border-[var(--border)]">
                {columnHeaders && (
                  <div className="flex items-center gap-3 border-b border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--muted-foreground)] sm:px-4">
                    <span className="w-8 shrink-0">#</span>
                    {columnHeaders.map((header, i) => (
                      <span
                        key={i}
                        className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
                      >
                        {header}
                      </span>
                    ))}
                    <span className="w-4 shrink-0" />
                  </div>
                )}
                {renderItems()}
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
    </>
  );
};