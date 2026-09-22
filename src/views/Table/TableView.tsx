import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthProvider";
import { useAppStore } from "../../stores/appStore";
import { PaginatedFilterSection } from "./PaginatedFilterSection";
import { usePaginatedRecords } from "../../hooks/usePaginatedRecords";
import { useFilterParams, filtersToParams } from "../../hooks/useFilterParams";
import { usePaginationParams } from "../../hooks/usePaginationParams";
import { buildFacetRequestFields } from "../../utils/loginsFilter";
import { Loader2 } from "lucide-react";
import { Section } from "../../components/Section";
import { buildLoginStatusFilter } from "../../utils/buildLoginStatusFilter";
import type {
  Agency,
  BulkStaff,
  FilterKeyMap,
  StaffFilters,
} from "../../types/domain";

interface TableViewProps<T extends Record<string, unknown>> {
  action?: ReactNode;
  title?: string;
  refreshTrigger?: number;
  renderItem: (item: T, index: number) => ReactNode;
  agencies?: Agency[];
  targetAgencyIds?: string[];
  namesLoading?: boolean;

  accordionType?: "single" | "multiple";
  multiAccordionValue?: string[];
  onMultiAccordionChange?: (value: string[]) => void;
  algoliaFilters?: string;
  onItemsChange?: (items: T[]) => void;

  indexName?: string;
  filterKeys?: FilterKeyMap;
  enableTagFilter?: boolean;
  enableLoginStatusFilter?: boolean;
  columnHeaders?: string[];
  expandable?: boolean;
}

const defaultFilterKeys: FilterKeyMap = {
  tag: "tags",
  agency: "metadata.assignedToId",
};

export const TableView = <T extends Record<string, unknown> = BulkStaff>({
  action,
  title,
  refreshTrigger,
  renderItem,
  agencies,
  targetAgencyIds,
  namesLoading,

  accordionType = "single",
  multiAccordionValue,
  onMultiAccordionChange,
  algoliaFilters,
  onItemsChange,

  indexName = "staff_name_desc",
  filterKeys = defaultFilterKeys,
  enableTagFilter: tagsEnabled = true,
  enableLoginStatusFilter: loginStatusEnabled,
  columnHeaders = ["Name", "Email", "Assigned To", "NI Number"],
  expandable = true,
}: TableViewProps<T>) => {
  const { appUser, role } = useAuth();
  const tags = useAppStore((s) => s.tags);
  const loadTags = useAppStore((s) => s.loadTags);
  const [filters, setFilters] = useFilterParams();
  const { page, pageSize, setPage, setPageSize } = usePaginationParams();
  const [, setRawSearchParams] = useSearchParams();
  const isClient = role === "client";
  const showLoginStatus = loginStatusEnabled ?? role === "super";

  const tagsMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const tag of tags) {
      map[tag.id] = tag.value;
    }
    return map;
  }, [tags]);

  const facetFilters = useMemo(() => {
    const ffs: string[][] = [];

    if (tagsEnabled) {
      for (const id of filters.tagIds) {
        ffs.push([`${filterKeys.tag}:${id}`]);
      }
    }

    if (filters.agencyIds.length > 0) {
      ffs.push(filters.agencyIds.map((n) => `${filterKeys.agency}:${n}`));
    }

    if (targetAgencyIds) {
      if (targetAgencyIds.length === 0) {
        ffs.push([`${filterKeys.agency}:__none__`]);
      } else {
        ffs.push(targetAgencyIds.map((id) => `${filterKeys.agency}:${id}`));
      }
    }

    if (showLoginStatus) {
      const loginStatus = buildLoginStatusFilter(
        filters.loginStatusFilter ?? "all"
      );
      if (loginStatus.facetFilters) ffs.push(...loginStatus.facetFilters);
    }

    return ffs;
  }, [filters, filterKeys, targetAgencyIds, tagsEnabled, showLoginStatus]);

  const combinedFilters = useMemo(() => {
    const parts: string[] = [];
    if (algoliaFilters) parts.push(`(${algoliaFilters})`);
    if (showLoginStatus) {
      const loginStatus = buildLoginStatusFilter(
        filters.loginStatusFilter ?? "all"
      );
      if (loginStatus.filterExpr) parts.push(`(${loginStatus.filterExpr})`);
    }
    return parts.length > 0 ? parts.join(" AND ") : undefined;
  }, [algoliaFilters, filters.loginStatusFilter, showLoginStatus]);

  const facets = useMemo(
    () => buildFacetRequestFields(filterKeys),
    [filterKeys]
  );

  const searchParams = useMemo(
    () => ({
      indexName,
      agencyId: appUser?.agencyId ?? "",
      facetFilters,
      filters: combinedFilters,
      facets,
      query: filters.name,
      page,
      hitsPerPage: pageSize,
      enabled: !namesLoading,
    }),
    [
      indexName,
      facetFilters,
      combinedFilters,
      facets,
      filters.name,
      page,
      pageSize,
      appUser?.agencyId,
      namesLoading,
    ]
  );

  const { items, loading, refresh, totalPages, totalResults, facetCounts } =
    usePaginatedRecords<T>(searchParams);

  const prevItems = useRef(items);
  useEffect(() => {
    if (items !== prevItems.current) {
      prevItems.current = items;
      onItemsChange?.(items);
    }
  }, [items, onItemsChange]);

  const prevRefreshTrigger = useRef(refreshTrigger);
  useEffect(() => {
    if (refreshTrigger !== prevRefreshTrigger.current) {
      prevRefreshTrigger.current = refreshTrigger;
      refresh();
    }
  }, [refreshTrigger, refresh]);

  const prevAgencyIds = useRef(targetAgencyIds);
  useEffect(() => {
    if (targetAgencyIds !== prevAgencyIds.current) {
      prevAgencyIds.current = targetAgencyIds;
      refresh();
    }
  }, [targetAgencyIds, refresh]);

  useEffect(() => {
    loadTags().catch(() => {});
  }, [loadTags]);

  // const filterTagsMap = useMemo(() => {
  //   if (!facetCounts?.tags) return tagsMap;
  //   return Object.fromEntries(
  //     Object.entries(tagsMap).filter(([id]) => (facetCounts.tags[id] ?? 0) > 0),
  //   );
  // }, [facetCounts, tagsMap]);

  // const filterAgencies = useMemo(() => {
  //   if (!agencies || !facetCounts?.[filterKeys.agency]) return agencies;
  //   const counts = facetCounts[filterKeys.agency];
  //   return agencies.filter((a) => (counts[a.id] ?? 0) > 0);
  // }, [agencies, facetCounts, filterKeys.agency]);

  // const handleFiltersChange = useCallback(
  //   (newFilters: StaffFilters) => {
  //     setFilters(newFilters);
  //     setRawSearchParams((prev) => {
  //       const next = filtersToParams(new URLSearchParams(prev), newFilters);
  //       next.set("page", "1");
  //       next.set("size", String(pageSize));
  //       return next;
  //     }, { replace: true });
  //   },
  //   [pageSize, setRawSearchParams, setFilters],
  // );

  const sectionTitle =
    title ??
    (isClient ? "Assigned Staff" : role === "super" ? "All Staff" : "Staff");

  if (namesLoading) {
    return (
      <Section title={sectionTitle}>
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
        </div>
      </Section>
    );
  }

  return (
    <PaginatedFilterSection
      title={sectionTitle}
      items={items}
      loading={loading}
      page={page}
      totalPages={totalPages}
      totalResults={totalResults}
      pageSize={pageSize}
      onPrevPage={() => setPage(Math.max(0, page - 1))}
      onNextPage={() => setPage(page + 1)}
      onGoToPage={setPage}
      onPageSizeChange={setPageSize}
      filters={filters}
      enableTagFilter={tagsEnabled}
      enableLoginStatusFilter={showLoginStatus}
      emptyMessage={
        isClient
          ? "You've not been assigned any staff yet"
          : role === "admin"
          ? "No staff assigned to your agencies"
          : undefined
      }
      action={!isClient ? action : undefined}
      renderItem={renderItem}
      columnHeaders={columnHeaders}
      accordionType={accordionType}
      multiAccordionValue={multiAccordionValue}
      onMultiAccordionChange={onMultiAccordionChange}
      expandable={expandable}
    />
  );
};
