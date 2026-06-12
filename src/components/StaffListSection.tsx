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
import { FileInteractionButtons } from "./FileInteractionButtons";
import { Metadata } from "./Metadata";
import { Pill } from "./Pill";
import { AccordionTitle } from "./AccordionTitle";
import {
  buildFacetFilters,
  buildFacetRequestFields,
} from "../utils/loginsFilter";
import { FileText } from "lucide-react";
import type {
  Agency,
  BulkStaff,
  FilterKeyMap,
  StaffFilters,
} from "../types/domain";

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
  const [pageSize, setPageSize] = useState(10);
  const isClient = view === "client";
  const assignedToId = targetAgencyId || appUser?.agencyId || "";
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
    const ffs = buildFacetFilters(filters, staffKeyMap);
    if (isClient && assignedToId) {
      ffs.push([`${staffKeyMap.agency}:${assignedToId}`]);
    }
    return ffs;
  }, [isClient, assignedToId, filters, staffKeyMap]);

  const facets = useMemo(
    () => buildFacetRequestFields(staffKeyMap),
    [staffKeyMap],
  );

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
            <div className="flex min-w-0 items-center gap-2">
              <AccordionTitle>{displayName}</AccordionTitle>
              {member.metadata?.cv && member.metadata.cv.length > 0 && (
                <Pill
                  status="cv"
                  icon={<FileText className="h-4 w-4" />}
                  label=""
                />
              )}
            </div>
          }
        >
          {member.tags && member.tags.length > 0 && (
            <Metadata
              title="Tags"
              value={member.tags.map((id) => tagsMap[id] || id).join(", ")}
              className="animate-cascade"
              style={{ animationDelay: "0ms" }}
            />
          )}
          {member.metadata?.cv && member.metadata.cv.length > 0 && (
            <div className="mt-2 flex flex-col gap-1 text-xs sm:text-sm">
              {member.metadata.cv.map((entry, idx) => (
                <Metadata
                  key={`${member.id}::${entry.fileName}`}
                  title="CV"
                  className="flex items-center animate-cascade"
                  style={{ animationDelay: `${(idx + 1) * 12}ms` } as React.CSSProperties}
                  value={
                    <span className="inline-flex flex-wrap items-center gap-2 align-middle">
                      <span className="text-[var(--muted-foreground)]">
                        {entry.fileName}
                      </span>
                      <FileInteractionButtons
                        fileUrl={entry.fileUrl}
                        fileName={entry.fileName}
                        interactionKey="cv"
                        size="md"
                      />
                    </span>
                  }
                />
              ))}
            </div>
          )}
          <div className="overflow-x-auto mt-2">
            <div className="w-max grid grid-rows-[repeat(6,auto)] grid-flow-col auto-cols-min gap-x-6 gap-y-1 text-xs sm:text-sm text-zinc-600">
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
                    key !== "sortableName" &&
                    value !== "" &&
                    value !== null &&
                    value !== undefined,
                )
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, value], idx) => {
                  const display =
                    value instanceof Date
                      ? formatInvitedAt(value)
                      : String(value ?? "");
                  return (
                    <p
                      key={key}
                      className="whitespace-nowrap px-1 animate-cascade"
                      style={
                        {
                          animationDelay: `${idx * 12}ms`,
                        } as React.CSSProperties
                      }
                    >
                      <span className="font-medium text-[var(--foreground)]">
                        {key}
                      </span>
                      <span className="font-medium">: {display}</span>
                    </p>
                  );
                })}
            </div>
          </div>
        </AccordionItem>
      );
    },
    [tagsMap],
  );

  return (
    <PaginatedFilterSection
      title={isClient ? "Assigned Staff" : "Staff"}
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
      enableAgencyFilter={!isClient}
      emptyMessage={
        isClient ? "You've not been assigned any staff yet" : undefined
      }
      action={!isClient ? action : undefined}
      renderItem={renderItem ?? defaultRenderItem}
    />
  );
};
