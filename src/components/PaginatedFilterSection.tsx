import { useMemo, useState, type ReactNode } from "react";
import { Filter, Loader2 } from "lucide-react";
import { AccordionRoot } from "./ui";
import { FilterModal } from "./FilterModal";
import { PaginationBar } from "./PaginationBar";
import { Section } from "./Section";
import { Muted } from "../config/typography";
import type { Agency, FilterKeyMap, StaffFilters } from "../types/domain";

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

  tags?: Record<string, string>;
  tagCounts?: Record<string, number>;
  agencies?: Agency[];
  agencyCounts?: Record<string, number>;

  emptyMessage?: string;
  noMatchMessage?: string;

  leftAccordionValue?: string;
  onLeftAccordionChange?: (value: string) => void;
  rightAccordionValue?: string;
  onRightAccordionChange?: (value: string) => void;
  initialLoading?: boolean;
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

  tags,
  tagCounts,
  agencies,
    agencyCounts,

    emptyMessage,
    noMatchMessage = "Oops there are no records with that filter",

    leftAccordionValue,
    onLeftAccordionChange,
    rightAccordionValue,
    onRightAccordionChange,
    initialLoading,
  }: PaginatedFilterSectionProps<T>) => {
  const [showFilterModal, setShowFilterModal] = useState(false);

  const hasAnyFilter =
    enableNameFilter || enableTagFilter || enableAgencyFilter;

  const mid = useMemo(() => Math.ceil(items.length / 2), [items.length]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (enableNameFilter && filters.name.length >= 3) count++;
    if (enableTagFilter) count += filters.tagIds.length;
    if (enableAgencyFilter) count += filters.agencyIds.length;
    return count;
  }, [filters, enableNameFilter, enableTagFilter, enableAgencyFilter]);

  const renderHeaderAction = () => (
    <div className="flex items-center gap-2">
      {hasAnyFilter && (totalResults > 0 || activeFilterCount > 0) && (
        <button
          type="button"
          onClick={() => setShowFilterModal(true)}
          className="relative inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--primary)]/20 bg-[var(--primary-400)] text-white transition hover:bg-[var(--primary-500)]/85"
        >
          <Filter className="h-3.5 w-3.5" />
          {activeFilterCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--primary)] text-[10px] font-bold text-white">
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
      <Section title={title} count={totalResults} action={renderHeaderAction()}>
        {initialLoading || (loading && items.length === 0) ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
          </div>
        ) : items.length === 0 ? (
          <Muted>
            {activeFilterCount > 0
              ? noMatchMessage
              : emptyMessage || `Add some ${title.toLowerCase()} now!`}
          </Muted>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col min-[1500px]:flex-row min-[1500px]:gap-x-3">
              <div className="flex-1">
                <AccordionRoot
                  type="single"
                  collapsible
                  {...(leftAccordionValue !== undefined && onLeftAccordionChange !== undefined
                    ? { value: leftAccordionValue, onValueChange: onLeftAccordionChange }
                    : {})}
                >
                  {items.slice(0, mid).map((item, idx) => renderItem(item, idx))}
                </AccordionRoot>
              </div>
              <div className="flex-1">
                <AccordionRoot
                  type="single"
                  collapsible
                  {...(rightAccordionValue !== undefined && onRightAccordionChange !== undefined
                    ? { value: rightAccordionValue, onValueChange: onRightAccordionChange }
                    : {})}
                >
                  {items.slice(mid).map((item, idx) => renderItem(item, mid + idx))}
                </AccordionRoot>
              </div>
            </div>
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
        )}
      </Section>

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
      />
    </>
  );
};
