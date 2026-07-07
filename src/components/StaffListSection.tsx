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
import { buildFacetRequestFields } from "../utils/loginsFilter";
import { FileText, Loader2 } from "lucide-react";
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
  renderItem?: (item: BulkStaff, index: number) => ReactNode;
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
  const { role } = useAuth();
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

    // Tags
    for (const id of filters.tagIds) {
      ffs.push([`${staffKeyMap.tag}:${id}`]);
    }

    // metadata.assignedToName
    if (targetAgencyNames && targetAgencyNames.length > 0) {
      ffs.push(targetAgencyNames.map((n) => `${staffKeyMap.agency}:${n}`));
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
      facetFilters: staffFacetFilters,
      facets,
      query: filters.name,
      page,
      hitsPerPage: pageSize,
    }),
    [staffFacetFilters, facets, filters.name, page, pageSize],
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
                  style={
                    {
                      animationDelay: `${(idx + 1) * 12}ms`,
                    } as React.CSSProperties
                  }
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
        isClient ? "You've not been assigned any staff yet" : undefined
      }
      action={!isClient ? action : undefined}
      renderItem={renderItem ?? defaultRenderItem}
      leftAccordionValue={leftAccordionValue}
      onLeftAccordionChange={onLeftAccordionChange}
      rightAccordionValue={rightAccordionValue}
      onRightAccordionChange={onRightAccordionChange}
    />
  );
};
