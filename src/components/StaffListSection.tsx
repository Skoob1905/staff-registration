import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AccordionItem } from "./ui";
import { useAuth } from "../context/AuthProvider";
import { useAppStore } from "../stores/appStore";
import { formatInvitedAt } from "../utils/date";
import { PaginatedFilterSection } from "./PaginatedFilterSection";
import { usePaginatedRecords } from "../hooks/usePaginatedRecords";
import { useFilterParams } from "../hooks/useFilterParams";
import { getStaffName } from "../utils/keyHeaderNormalisation";
import type { Agency, BulkStaff, StaffFilters } from "../types/domain";

interface StaffListSectionProps {
  view: "admin" | "client";
  targetAgencyId?: string;
  action?: ReactNode;
  refreshTrigger?: number;
  renderItem?: (item: BulkStaff, index: number) => ReactNode;
  agencies?: Agency[];
}

export const StaffListSection = ({
  view,
  targetAgencyId,
  action,
  refreshTrigger,
  renderItem,
  agencies,
}: StaffListSectionProps) => {
  const { appUser } = useAuth();
  const tags = useAppStore((s) => s.tags);
  const loadTags = useAppStore((s) => s.loadTags);
  const [filters, setFilters] = useFilterParams();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const isClient = view === "client";
  const assignedToId = targetAgencyId || appUser?.agencyId || "";
  const facets = useMemo<string[]>(() => ["tags", "metadata.assignedToId"], []);

  const tagsMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const tag of tags) {
      map[tag.id] = tag.value;
    }
    return map;
  }, [tags]);

  const staffFacetFilters = useMemo(() => {
    const ffs: string[][] = [];
    if (isClient && assignedToId) {
      ffs.push([`metadata.assignedToId:${assignedToId}`]);
    }
    if (filters.tagIds.length > 0) {
      ffs.push(filters.tagIds.map((id) => `tags:${id}`));
    }
    return ffs;
  }, [isClient, assignedToId, filters.tagIds]);

  const { items, loading, refresh, totalPages, totalResults, facetCounts } =
    usePaginatedRecords<BulkStaff>({
      indexName: "staff_name_desc",
      agencyId: "all",
      facetFilters: staffFacetFilters,
      facets,
      query: filters.name,
      page,
      hitsPerPage: pageSize,
    });

  const prevRefreshTrigger = useRef(refreshTrigger);
  useEffect(() => {
    if (refreshTrigger !== prevRefreshTrigger.current) {
      prevRefreshTrigger.current = refreshTrigger;
      refresh();
    }
  }, [refreshTrigger, refresh]);

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
      setPage(0);
      setFilters(newFilters);
    },
    [setFilters],
  );

  const defaultRenderItem = useCallback(
    (member: BulkStaff, idx: number) => {
      const displayName = getStaffName(member);
      return (
        <AccordionItem
          key={member.id}
          value={member.id}
          className="animate-cascade"
          style={{ animationDelay: `${idx * 5}ms` } as React.CSSProperties}
          title={
            <div className="flex flex-col min-w-0">
              <span className="truncate font-medium">{displayName}</span>
            </div>
          }
        >
          {member.tags && member.tags.length > 0 && (
            <>
              <span className="font-medium text-[var(--foreground)]">
                Tags:
              </span>
              <span className="font-medium pl-1">
                {member.tags.map((id) => tagsMap[id] || id).join(", ")}
              </span>
            </>
          )}
          <div className="max-h-[100px] overflow-y-auto columns-2 gap-x-4 text-xs sm:text-sm text-zinc-600 mt-2">
            {Object.entries(member)
              .filter(
                ([key, value]) =>
                  key !== "id" &&
                  key !== "uid" &&
                  key !== "metadata" &&
                  key !== "agencyId" &&
                  key !== "importedByAgencyId" &&
                  key !== "tags" &&
                  key !== "typeIds" &&
                  value !== "" &&
                  value !== null &&
                  value !== undefined,
              )
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, value]) => {
                const display =
                  value instanceof Date
                    ? formatInvitedAt(value)
                    : String(value ?? "");
                return (
                  <p key={key} className="break-inside-avoid">
                    <span className="font-medium text-[var(--foreground)]">
                      {key}
                    </span>
                    <span className="font-medium">: {display}</span>
                  </p>
                );
              })}
          </div>
        </AccordionItem>
      );
    },
    [tagsMap],
  );

  return (
    <PaginatedFilterSection
      title={isClient ? "Assigned Staff" : "Staff"}
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
      enableAgencyFilter={!isClient}
      emptyMessage={
        isClient ? "You've not been assigned any staff yet" : undefined
      }
      action={!isClient ? action : undefined}
      renderItem={renderItem ?? defaultRenderItem}
    />
  );
};
