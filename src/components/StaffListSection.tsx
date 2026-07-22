import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import { useAppStore } from "../stores/appStore";
import { PaginatedFilterSection } from "./PaginatedFilterSection";
import { usePaginatedRecords } from "../hooks/usePaginatedRecords";
import { useFilterParams, filtersToParams } from "../hooks/useFilterParams";
import { usePaginationParams } from "../hooks/usePaginationParams";
import { buildFacetRequestFields } from "../utils/loginsFilter";
import { Loader2 } from "lucide-react";
import { Section } from "./Section";
import { buildLoginStatusFilter } from "./filters/IsLoggedIn";
import type {
  Agency,
  BulkStaff,
  FilterKeyMap,
  StaffFilters,
} from "../types/domain";

interface StaffListSectionProps {
  action?: ReactNode;
  title?: string;
  refreshTrigger?: number;
  renderItem: (item: BulkStaff, index: number) => ReactNode;
  agencies?: Agency[];
  targetAgencyIds?: string[];
  namesLoading?: boolean;

  leftAccordionValue?: string;
  onLeftAccordionChange?: (value: string) => void;
  rightAccordionValue?: string;
  onRightAccordionChange?: (value: string) => void;

  accordionLayout?: "dual" | "single";
  accordionType?: "single" | "multiple";
  multiAccordionValue?: string[];
  onMultiAccordionChange?: (value: string[]) => void;
  algoliaFilters?: string;
  onItemsChange?: (items: BulkStaff[]) => void;
}

export const StaffListSection = ({
  action,
  title,
  refreshTrigger,
  renderItem,
  agencies,
  targetAgencyIds,
  namesLoading,

  leftAccordionValue,
  onLeftAccordionChange,
  rightAccordionValue,
  onRightAccordionChange,

  accordionLayout = "dual",
  accordionType = "single",
  multiAccordionValue,
  onMultiAccordionChange,
  algoliaFilters,
  onItemsChange,
}: StaffListSectionProps) => {
  const { appUser, role } = useAuth();
  const tags = useAppStore((s) => s.tags);
  const loadTags = useAppStore((s) => s.loadTags);
  const [filters, setFilters] = useFilterParams();
  const { page, pageSize, setPage, setPageSize } = usePaginationParams();
  const [, setRawSearchParams] = useSearchParams();
  const isClient = role === "client";

  const staffKeyMap = useMemo<FilterKeyMap>(
    () => ({ tag: "tags", agency: "metadata.assignedToId" }),
    [],
  );

  const tagsMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const tag of tags) {
      map[tag.id] = tag.value;
    }
    return map;
  }, [tags]);

  const staffFacetFilters = useMemo(() => {
    const ffs: string[][] = [];

    for (const id of filters.tagIds) {
      ffs.push([`${staffKeyMap.tag}:${id}`]);
    }

    if (filters.agencyIds.length > 0) {
      ffs.push(filters.agencyIds.map((n) => `${staffKeyMap.agency}:${n}`));
    }

    if (targetAgencyIds) {
      if (targetAgencyIds.length === 0) {
        ffs.push([`${staffKeyMap.agency}:__none__`]);
      } else {
        ffs.push(targetAgencyIds.map((id) => `${staffKeyMap.agency}:${id}`));
      }
    }

    const loginStatus = buildLoginStatusFilter(
      filters.loginStatusFilter ?? "all",
    );
    if (loginStatus.facetFilters) ffs.push(...loginStatus.facetFilters);

    return ffs;
  }, [filters, staffKeyMap, targetAgencyIds]);

  const combinedFilters = useMemo(() => {
    const parts: string[] = [];
    if (algoliaFilters) parts.push(`(${algoliaFilters})`);
    const loginStatus = buildLoginStatusFilter(
      filters.loginStatusFilter ?? "all",
    );
    if (loginStatus.filterExpr) parts.push(`(${loginStatus.filterExpr})`);
    return parts.length > 0 ? parts.join(" AND ") : undefined;
  }, [algoliaFilters, filters.loginStatusFilter]);

  const facets = useMemo(
    () => buildFacetRequestFields(staffKeyMap),
    [staffKeyMap],
  );

  const searchParams = useMemo(
    () => ({
      indexName: "staff_name_desc",
      agencyId: appUser?.agencyId ?? "",
      facetFilters: staffFacetFilters,
      filters: combinedFilters,
      facets,
      query: filters.name,
      page,
      hitsPerPage: pageSize,
      enabled: !namesLoading,
    }),
    [
      staffFacetFilters,
      combinedFilters,
      facets,
      filters.name,
      page,
      pageSize,
      appUser?.agencyId,
      namesLoading,
    ],
  );

  const { items, loading, refresh, totalPages, totalResults, facetCounts } =
    usePaginatedRecords<BulkStaff>(searchParams);

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

  const filterTagsMap = useMemo(() => {
    if (!facetCounts?.tags) return tagsMap;
    return Object.fromEntries(
      Object.entries(tagsMap).filter(([id]) => (facetCounts.tags[id] ?? 0) > 0),
    );
  }, [facetCounts, tagsMap]);

  const filterAgencies = useMemo(() => {
    if (!agencies || !facetCounts?.["metadata.assignedToId"]) return agencies;
    const counts = facetCounts["metadata.assignedToId"];
    return agencies.filter((a) => (counts[a.id] ?? 0) > 0);
  }, [agencies, facetCounts]);

  const handleFiltersChange = useCallback(
    (newFilters: StaffFilters) => {
      setFilters(newFilters);
      setRawSearchParams((prev) => {
        const next = filtersToParams(new URLSearchParams(prev), newFilters);
        next.set("page", "1");
        next.set("size", String(pageSize));
        return next;
      }, { replace: true });
    },
    [pageSize, setRawSearchParams, setFilters],
  );

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
      filterKeys={staffKeyMap}
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
      onFiltersChange={handleFiltersChange}
      tags={filterTagsMap}
      tagCounts={facetCounts?.tags}
      agencies={filterAgencies}
      enableAgencyFilter={Boolean(
        !isClient || (agencies && agencies.length > 0),
      )}
      enableTagFilter
      enableLoginStatusFilter={role === "super"}
      emptyMessage={
        isClient
          ? "You've not been assigned any staff yet"
          : role === "admin"
            ? "No staff assigned to your agencies"
            : undefined
      }
      action={!isClient ? action : undefined}
      renderItem={renderItem}
      leftAccordionValue={leftAccordionValue}
      onLeftAccordionChange={onLeftAccordionChange}
      rightAccordionValue={rightAccordionValue}
      onRightAccordionChange={onRightAccordionChange}
      singleColumn={accordionLayout === "single"}
      accordionType={accordionType}
      multiAccordionValue={multiAccordionValue}
      onMultiAccordionChange={onMultiAccordionChange}
    />
  );
};
