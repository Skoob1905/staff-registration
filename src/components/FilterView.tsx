import { useMemo, useState, type ReactNode } from "react";
import { Filter } from "lucide-react";
import { Card } from "./ui";
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
  noMatchMessage = "No items match the current filters",
  action,
  enableNameFilter = true,
  enableTypeFilter = false,
  enableTagFilter = false,
  enableAgencyFilter = false,
  hideClear = false,
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

    return result;
  }, [
    items,
    filters,
    searchFields,
    enableNameFilter,
    enableTypeFilter,
    enableTagFilter,
    enableAgencyFilter,
  ]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (enableNameFilter && filters.name.length >= 3) count++;
    if (enableTypeFilter && filters.typeIds.length > 0) count++;
    if (enableTagFilter && filters.tagIds.length > 0) count++;
    if (enableAgencyFilter && filters.agencyIds.length > 0) count++;
    return count;
  }, [filters, enableNameFilter, enableTypeFilter, enableTagFilter, enableAgencyFilter]);

  const hasAnyFilter =
    enableNameFilter || enableTypeFilter || enableTagFilter || enableAgencyFilter;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm sm:text-lg font-bold">
            {title} ({filteredItems.length}/{items.length})
          </h2>
          {hasAnyFilter && (
            <button
              type="button"
              onClick={() => setShowFilterModal(true)}
              className="relative inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted-foreground)] transition hover:bg-[color:rgba(31,79,138,0.06)]"
            >
              <Filter className="h-3.5 w-3.5" />
              {activeFilterCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--primary)] text-[9px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          )}
        </div>
        {action}
      </div>

      <div className="mt-1.5 sm:mt-3">
        {items.length === 0 ? (
          <p className="text-xs sm:text-sm text-[var(--muted-foreground)]">
            {emptyMessage || `Add some ${title.toLowerCase()} now!`}
          </p>
        ) : filteredItems.length === 0 ? (
          <p className="text-xs sm:text-sm text-[var(--muted-foreground)]">
            {noMatchMessage}
          </p>
        ) : (
          children(filteredItems)
        )}
      </div>

      <StaffFilterModal
        open={showFilterModal}
        onOpenChange={setShowFilterModal}
        agencies={agencies}
        items={items as Record<string, unknown>[]}
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
