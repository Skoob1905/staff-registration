import { useMemo, useState, type ReactNode } from "react";
import { Filter } from "lucide-react";
import { Card } from "./ui";
import { PaginationBar } from "./PaginationBar";
import { StaffFilterModal } from "./StaffFilterModal";
import type { Agency, StaffFilters, StaffType } from "../types/domain";

interface FilterViewProps<T> {
  title: string;
  items: T[];
  filters: StaffFilters;
  onFiltersChange: (filters: StaffFilters) => void;
  searchFields: (keyof T)[];
  agencies?: Agency[];
  tags?: Record<string, string>;
  staffTypes?: StaffType[];
  children: (filteredItems: T[]) => ReactNode;
  emptyMessage?: string;
  noMatchMessage?: string;
  action?: ReactNode;
  enableNameFilter?: boolean;
  enableTypeFilter?: boolean;
  enableTagFilter?: boolean;
  enableAgencyFilter?: boolean;
  hideClear?: boolean;
  pagination?: boolean;
  currentPage?: number;
  totalPages?: number;
  totalCount?: number;
  pageSize?: number;
  loading?: boolean;
  onPrevPage?: () => void;
  onNextPage?: () => void;
  onGoToPage?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export const FilterView = <T,>({
  title,
  items,
  filters,
  onFiltersChange,
  searchFields,
  agencies,
  tags,
  staffTypes = [],
  children,
  emptyMessage = "",
  noMatchMessage = "Oops there are no records with that filter",
  action,
  enableNameFilter = true,
  enableTypeFilter = false,
  enableTagFilter = false,
  enableAgencyFilter = false,
  hideClear = false,
  pagination = false,
  currentPage = 1,
  totalPages = 1,
  totalCount = 0,
  pageSize = 50,
  loading = false,
  onPrevPage,
  onNextPage,
  onGoToPage,
  onPageSizeChange,
}: FilterViewProps<T>) => {
  const [showFilterModal, setShowFilterModal] = useState(false);

  const filteredItems = useMemo(() => {
    let result = items;

    if (enableNameFilter && filters.name.length >= 3) {
      const q = filters.name.toLowerCase();
      result = result.filter((item) =>
        (searchFields as (keyof T)[]).some((field) => {
          const val = (item as Record<string, unknown>)[field as string];
          return typeof val === "string" && val.toLowerCase().includes(q);
        }),
      );
    }

    if (!pagination) {
      if (enableTypeFilter && filters.typeIds.length > 0) {
        const typeSet = new Set(filters.typeIds);
        result = result.filter((s) => {
          const ids = (s as Record<string, unknown>).typeIds as
            | string[]
            | undefined;
          return ids?.some((t: string) => typeSet.has(t));
        });
      }

      if (enableTagFilter && filters.tagIds.length > 0) {
        const tagSet = new Set(filters.tagIds);
        result = result.filter((s) => {
          const ids = (s as Record<string, unknown>).tags as
            | string[]
            | undefined;
          return ids?.some((t: string) => tagSet.has(t));
        });
      }

      if (enableAgencyFilter && filters.agencyIds.length > 0) {
        const agencySet = new Set(filters.agencyIds);
        result = result.filter((s) => {
          const meta = (s as Record<string, unknown>).metadata as
            | { assignedToId?: string }
            | undefined;
          return meta?.assignedToId && agencySet.has(meta.assignedToId);
        });
      }
    }

    return result;
  }, [
    items,
    filters,
    searchFields,
    enableNameFilter,
    enableTypeFilter,
    enableTagFilter,
    enableAgencyFilter,
    pagination,
  ]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (enableNameFilter && filters.name.length >= 3) count++;
    if (enableTypeFilter && filters.typeIds.length > 0) count++;
    if (enableTagFilter && filters.tagIds.length > 0) count++;
    if (enableAgencyFilter && filters.agencyIds.length > 0) count++;
    return count;
  }, [
    filters,
    enableNameFilter,
    enableTypeFilter,
    enableTagFilter,
    enableAgencyFilter,
  ]);

  const hasAnyFilter =
    enableNameFilter ||
    enableTypeFilter ||
    enableTagFilter ||
    enableAgencyFilter;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="text-base sm:text-lg font-bold">
          {pagination ? `${title} (${totalCount})` : title}
        </h2>
        <div className="flex items-center gap-2">
          {hasAnyFilter && (
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
      </div>

      <div className="mt-1.5 sm:mt-3">
        {pagination && loading && items.length === 0 ? (
          <p className="text-xs sm:text-sm text-[var(--muted-foreground)]">
            Loading...
          </p>
        ) : items.length === 0 ? (
          <p className="text-xs sm:text-sm text-[var(--muted-foreground)]">
            {activeFilterCount > 0
              ? noMatchMessage
              : emptyMessage || `Add some ${title.toLowerCase()} now!`}
          </p>
        ) : filteredItems.length === 0 ? (
          <p className="text-xs sm:text-sm text-[var(--muted-foreground)]">
            {noMatchMessage}
          </p>
        ) : (
          children(filteredItems)
        )}
      </div>

      {pagination &&
        onPrevPage &&
        onNextPage &&
        onGoToPage &&
        onPageSizeChange && (
          <PaginationBar
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={pageSize}
            loading={loading}
            onPrev={onPrevPage}
            onNext={onNextPage}
            onGoToPage={onGoToPage}
            onPageSizeChange={onPageSizeChange}
          />
        )}

      <StaffFilterModal
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
    </Card>
  );
};
