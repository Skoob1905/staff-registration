import { useMemo, useState, type ReactNode } from "react";
import { Filter, Loader2 } from "lucide-react";
import { AccordionRoot } from "../../components/ui";
import { FilterModal } from "./FilterModal";
import { PaginationBar } from "./PaginationBar";
import { Muted } from "../../config/typography";
import type { Agency, FilterKeyMap, StaffFilters } from "../../types/domain";

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
  onFiltersChange: (filters: StaffFilters) => void;

  filterKeys?: FilterKeyMap;
  enableNameFilter?: boolean;
  enableTagFilter?: boolean;
  enableAgencyFilter?: boolean;
  enableLoginStatusFilter?: boolean;

  tags?: Record<string, string>;
  tagCounts?: Record<string, number>;
  agencies?: Agency[];
  agencyCounts?: Record<string, number>;

  emptyMessage?: string;
  noMatchMessage?: string;

  columnHeaders?: string[];

  accordionType?: "single" | "multiple";
  multiAccordionValue?: string[];
  onMultiAccordionChange?: (value: string[]) => void;
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
  onFiltersChange,

  filterKeys,
  enableNameFilter = true,
  enableTagFilter = true,
  enableAgencyFilter = false,
  enableLoginStatusFilter = false,

  tags,
  tagCounts,
  agencies,
  agencyCounts,

  emptyMessage,
  noMatchMessage = "Oops there are no records with that filter",

  columnHeaders,

  accordionType = "single",
  multiAccordionValue,
  onMultiAccordionChange,
}: PaginatedFilterSectionProps<T>) => {
  const [showFilterModal, setShowFilterModal] = useState(false);

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
          onClick={() => setShowFilterModal(true)}
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
                {accordionType === "multiple" ? (
                  <AccordionRoot
                    type="multiple"
                    value={multiAccordionValue ?? []}
                    onValueChange={onMultiAccordionChange ?? (() => {})}
                  >
                    {items.map((item, idx) => renderItem(item, idx))}
                  </AccordionRoot>
                ) : (
                  <AccordionRoot type="single" collapsible>
                    {items.map((item, idx) => renderItem(item, idx))}
                  </AccordionRoot>
                )}
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

      <FilterModal
        open={showFilterModal}
        onOpenChange={setShowFilterModal}
        filterKeys={filterKeys}
        agencies={agencies}
        agencyCounts={agencyCounts}
        filters={filters}
        onApply={onFiltersChange}
        tags={tags}
        tagCounts={tagCounts}
        enableName={enableNameFilter}
        enableTag={enableTagFilter}
        enableAgency={enableAgencyFilter}
        enableLoginStatus={enableLoginStatusFilter}
      />
    </>
  );
};
