import { useMemo, useState, type ReactNode } from "react";
import { Filter, Loader2 } from "lucide-react";
import { AccordionRoot } from "../../components/ui";
import { FilterModal } from "./FilterModal";
import { PaginationBar } from "./PaginationBar";
import { PageTitle } from "../../components/PageTitle";
import { Muted } from "../../config/typography";
import {
  buildAgencyNameMap,
  buildFilterSummary,
} from "../../utils/filterSummary";
import type { Agency, FilterKeyMap, StaffFilters } from "../../types/domain";

export type ColumnHeader = string | { label: string; className?: string };

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
  nameFilterLabel?: string;
  showAllTags?: boolean;

  tags?: Record<string, string>;
  tagCounts?: Record<string, number>;
  agencies?: Agency[];
  agencyCounts?: Record<string, number>;

  emptyMessage?: string;
  noMatchMessage?: string;

  columnHeaders?: ColumnHeader[];

  accordionType?: "single" | "multiple";
  multiAccordionValue?: string[];
  onMultiAccordionChange?: (value: string[]) => void;

  expandable?: boolean;

  leftAccordionValue?: string;
  onLeftAccordionChange?: (value: string) => void;
  rightAccordionValue?: string;
  onRightAccordionChange?: (value: string) => void;
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
  nameFilterLabel,
  showAllTags = false,

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

  expandable = true,
}: PaginatedFilterSectionProps<T>) => {
  const [showFilterModal, setShowFilterModal] = useState(false);

  const hasAnyFilter =
    enableNameFilter || enableTagFilter || enableAgencyFilter;

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (enableNameFilter && filters.name.length >= 3) count++;
    if (enableTagFilter) count += filters.tagIds.length;
    if (enableAgencyFilter) count += filters.agencyIds.length;
    return count;
  }, [filters, enableNameFilter, enableTagFilter, enableAgencyFilter]);

  const filterSummary = useMemo(() => {
    const agencyNameMap = buildAgencyNameMap(agencies);
    return buildFilterSummary(
      filters,
      { tags, agencies: agencyNameMap },
      {
        includeName: enableNameFilter,
        includeTags: enableTagFilter,
        includeAgencies: enableAgencyFilter,
      }
    );
  }, [
    filters,
    tags,
    agencies,
    enableNameFilter,
    enableTagFilter,
    enableAgencyFilter,
  ]);

  const renderHeaderAction = () => (
    <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
      {hasAnyFilter && (totalResults > 0 || activeFilterCount > 0) && (
        <button
          type="button"
          onClick={() => setShowFilterModal(true)}
          className="inline-flex min-w-0 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
        >
          <Filter className="h-3.5 w-3.5 shrink-0" />
          <span className="shrink-0">Filter</span>
          {activeFilterCount > 0 && (
            <span className="ml-0.5 flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
          {filterSummary && (
            <span className="min-w-0 max-w-[240px] truncate text-[var(--muted-foreground)]">
              {filterSummary}
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
            {items.map((item, idx) => renderItem(item, page * pageSize + idx))}
          </AccordionRoot>
        );
      }
      return (
        <AccordionRoot type="single" collapsible>
          {items.map((item, idx) => renderItem(item, page * pageSize + idx))}
        </AccordionRoot>
      );
    }

    return (
      <div>
        {items.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center gap-3 border-b border-[var(--border)] px-3 py-2 text-left transition-colors last:border-0 hover:bg-[color:rgba(0,95,87,0.04)] sm:px-4"
          >
            <span className="w-8 shrink-0 text-left text-xs tabular-nums text-[var(--muted-foreground)]">
              {page * pageSize + idx + 1}
            </span>
            {renderItem(item, page * pageSize + idx)}
            <span className="w-4 shrink-0" />
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="shrink-0">
          <PageTitle action={renderHeaderAction()}>
            {title} ({totalResults})
          </PageTitle>
        </div>

        <div className="mt-1.5 flex min-h-0 flex-1 flex-col sm:mt-3">
          {loading && items.length === 0 ? (
            <div className="flex flex-1 justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
            </div>
          ) : items.length === 0 ? (
            <Muted className="px-4">
              {activeFilterCount > 0
                ? noMatchMessage
                : emptyMessage || `Add some ${title.toLowerCase()} now!`}
            </Muted>
          ) : (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto border-y border-[var(--border)]">
                {columnHeaders && (
                  <div className="hidden items-center gap-3 border-b border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--muted-foreground)] sm:flex sm:px-4">
                    <span className="w-8 shrink-0 text-left">#</span>
                    {columnHeaders.map((header, i) => {
                      const label =
                        typeof header === "string" ? header : header.label;
                      const className =
                        typeof header === "string"
                          ? "flex-1"
                          : header.className ?? "flex-1";
                      return (
                        <span
                          key={i}
                          className={`min-w-0 overflow-hidden text-left text-ellipsis whitespace-nowrap ${className}`}
                        >
                          {label}
                        </span>
                      );
                    })}
                    <span className="w-4 shrink-0" />
                  </div>
                )}
                {renderItems()}
              </div>
              <div className="shrink-0 bg-[var(--header-bg)] px-4 py-2">
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
        nameLabel={nameFilterLabel}
        showAllTags={showAllTags}
      />
    </>
  );
};
