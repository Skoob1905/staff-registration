import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "../context/AuthProvider";
import { useAppStore } from "../stores/appStore";
import { PaginatedFilterSection } from "./PaginatedFilterSection";
import { usePaginatedRecords } from "../hooks/usePaginatedRecords";
import { useFilterParams } from "../hooks/useFilterParams";
import { buildFacetRequestFields } from "../utils/loginsFilter";
import { Loader2 } from "lucide-react";
import { Section } from "./Section";
import type {
  Agency,
  BulkStaff,
  FilterKeyMap,
  StaffFilters,
} from "../types/domain";

interface StaffListSectionProps {
  action?: ReactNode;
  refreshTrigger?: number;
  renderItem: (item: BulkStaff, index: number) => ReactNode;
  agencies?: Agency[];
  targetAgencyNames?: string[];
  namesLoading?: boolean;

  leftAccordionValue?: string;
  onLeftAccordionChange?: (value: string) => void;
  rightAccordionValue?: string;
  onRightAccordionChange?: (value: string) => void;
}

export const StaffListSection = ({
  action,
  refreshTrigger,
  renderItem,
  agencies,
  targetAgencyNames,
  namesLoading,

  leftAccordionValue,
  onLeftAccordionChange,
  rightAccordionValue,
  onRightAccordionChange,
}: StaffListSectionProps) => {
  const { appUser, role } = useAuth();
  const tags = useAppStore((s) => s.tags);
  const loadTags = useAppStore((s) => s.loadTags);
  const [filters, setFilters] = useFilterParams();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const isClient = role === "client";

  const staffKeyMap = useMemo<FilterKeyMap>(
    () => ({ tag: "tags", agency: "metadata.assignedToName" }),
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

    if (targetAgencyNames) {
      if (targetAgencyNames.length === 0) {
        ffs.push([`${staffKeyMap.agency}:__none__`]);
      } else {
        ffs.push(targetAgencyNames.map((n) => `${staffKeyMap.agency}:${n}`));
      }
      return ffs;
    }

    return ffs;
  }, [filters, staffKeyMap, targetAgencyNames]);

  const facets = useMemo(
    () => buildFacetRequestFields(staffKeyMap),
    [staffKeyMap],
  );

  const searchParams = useMemo(
    () => ({
      indexName: "staff_name_desc",
      agencyId: appUser?.agencyId ?? "",
      facetFilters: staffFacetFilters,
      facets,
      query: filters.name,
      page,
      hitsPerPage: pageSize,
      enabled: !namesLoading,
    }),
    [staffFacetFilters, facets, filters.name, page, pageSize, appUser?.agencyId, namesLoading],
  );

  useEffect(() => {
    console.log("[StaffListSection] Algolia search:", searchParams);
  }, [searchParams]);

  const { items, loading, refresh, totalPages, totalResults, facetCounts } =
    usePaginatedRecords<BulkStaff>(searchParams);

  const prevRefreshTrigger = useRef(refreshTrigger);
  useEffect(() => {
    if (refreshTrigger !== prevRefreshTrigger.current) {
      prevRefreshTrigger.current = refreshTrigger;
      refresh();
    }
  }, [refreshTrigger, refresh]);

  const prevAgencyNames = useRef(targetAgencyNames);
  useEffect(() => {
    if (targetAgencyNames !== prevAgencyNames.current) {
      prevAgencyNames.current = targetAgencyNames;
      refresh();
    }
  }, [targetAgencyNames, refresh]);

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
    if (!agencies || !facetCounts?.["metadata.assignedToName"]) return agencies;
    const counts = facetCounts["metadata.assignedToName"];
    return agencies.filter((a) => (counts[a.name] ?? 0) > 0);
  }, [agencies, facetCounts]);

  const handleFiltersChange = useCallback(
    (newFilters: StaffFilters) => {
      setPage(0);
      setFilters(newFilters);
    },
    [setFilters],
  );

  const sectionTitle =
    isClient ? "Assigned Staff" : role === "super" ? "All Staff" : "Staff";

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
      onPrevPage={() => setPage((p) => Math.max(0, p - 1))}
      onNextPage={() => setPage((p) => p + 1)}
      onGoToPage={setPage}
      onPageSizeChange={(s) => {
        setPageSize(s);
        setPage(0);
      }}
      filters={filters}
      onFiltersChange={handleFiltersChange}
      tags={filterTagsMap}
      tagCounts={facetCounts?.tags}
      agencies={filterAgencies}
      enableAgencyFilter={Boolean(
        !isClient || (agencies && agencies.length > 0),
      )}
      enableTagFilter
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
    />
  );
};
