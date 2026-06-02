import { useMemo, useState, type ReactNode } from "react";
import { Filter } from "lucide-react";
import { AccordionRoot } from "./ui";
import { FilterModal } from "./FilterModal";
import { PaginationBar } from "./PaginationBar";
import { Section } from "./Section";
import { Muted } from "../config/typography";
import type { Agency, StaffFilters, StaffType } from "../types/domain";

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

  enableNameFilter?: boolean;
  enableTypeFilter?: boolean;
  enableTagFilter?: boolean;
  enableAgencyFilter?: boolean;
  hideClear?: boolean;

  tags?: Record<string, string>;
  agencies?: Agency[];
  staffTypes?: StaffType[];

  emptyMessage?: string;
  noMatchMessage?: string;
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

  enableNameFilter = true,
  enableTypeFilter = false,
  enableTagFilter = false,
  enableAgencyFilter = false,
  hideClear = false,

  tags,
  agencies,
  staffTypes,

  emptyMessage,
  noMatchMessage = "Oops there are no records with that filter",
}: PaginatedFilterSectionProps<T>) => {
  const [showFilterModal, setShowFilterModal] = useState(false);

  const hasAnyFilter = enableNameFilter || enableTypeFilter || enableTagFilter || enableAgencyFilter;

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (enableNameFilter && filters.name.length >= 3) count++;
    if (enableTypeFilter && filters.typeIds.length > 0) count++;
    if (enableTagFilter && filters.tagIds.length > 0) count++;
    if (enableAgencyFilter && filters.agencyIds.length > 0) count++;
    return count;
  }, [filters, enableNameFilter, enableTypeFilter, enableTagFilter, enableAgencyFilter]);

  const renderHeaderAction = () => (
    <div className="flex items-center gap-2">
      {hasAnyFilter && (totalResults > 0 || activeFilterCount > 0) && (
        <button
          type="button"
          onClick={() => setShowFilterModal(true)}
          className="relative inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted-foreground)] transition hover:bg-[color:rgba(0,95,87,0.06)]"
        >
          <Filter className="h-3.5 w-3.5" />
          {activeFilterCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--primary)] text-[9px] font-bold text-white">
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
        {loading && items.length === 0 ? (
          <Muted>Loading...</Muted>
        ) : items.length === 0 ? (
          <Muted>{activeFilterCount > 0 ? noMatchMessage : emptyMessage || `Add some ${title.toLowerCase()} now!`}</Muted>
        ) : (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border border-[var(--border)]">
              <AccordionRoot type="multiple">
                {items.map((item, idx) => renderItem(item, idx))}
              </AccordionRoot>
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
        agencies={agencies}
        filters={filters}
        onApply={onFiltersChange}
        tags={tags}
        staffTypes={staffTypes}
        enableName={enableNameFilter}
        enableType={enableTypeFilter}
        enableTag={enableTagFilter}
        enableAgency={enableAgencyFilter}
        hideClear={hideClear}
      />
    </>
  );
};
