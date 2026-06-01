import { useEffect, useMemo, useState } from "react";
import { AccordionItem } from "./ui";
import { useAuth } from "../context/AuthProvider";
import { useAppStore } from "../stores/appStore";
import { formatInvitedAt } from "../utils/date";
import { PaginatedFilterSection } from "./PaginatedFilterSection";
import { usePaginatedRecords } from "../hooks/usePaginatedRecords";
import { useFilterParams } from "../hooks/useFilterParams";
import { getStaffName } from "../utils/keyHeaderNormalisation";
import type { BulkStaff } from "../types/domain";

interface AssignedStaffSectionProps {
  targetAgencyId?: string;
}

export const AssignedStaffSection = ({
  targetAgencyId,
}: AssignedStaffSectionProps) => {
  const { appUser } = useAuth();
  const currentAgencyId = appUser?.agencyId;
  const assignedToId = targetAgencyId || currentAgencyId;

  const tags = useAppStore((s) => s.tags);
  const loadTags = useAppStore((s) => s.loadTags);

  const tagsMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const tag of tags) {
      map[tag.id] = tag.value;
    }
    return map;
  }, [tags]);

  const [filters, setFilters] = useFilterParams();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  const staffFacetFilters = useMemo(() => {
    const ffs: string[][] = [[`metadata.assignedToId:${assignedToId}`]];
    if (filters.tagIds.length > 0) {
      ffs.push(filters.tagIds.map((id) => `tags:${id}`));
    }
    return ffs;
  }, [assignedToId, filters.tagIds]);

  const { items, loading, totalPages, totalResults } = usePaginatedRecords<BulkStaff>({
    indexName: "staff",
    agencyId: currentAgencyId ?? "",
    facetFilters: staffFacetFilters,
    query: filters.name,
    page,
    hitsPerPage: pageSize,
  });

  useEffect(() => {
    loadTags().catch(() => {});
  }, [loadTags]);

  return (
    <PaginatedFilterSection
      title="Assigned Staff"
      items={items}
      loading={loading}
      page={page}
      totalPages={totalPages}
      totalResults={totalResults}
      pageSize={pageSize}
      onPrevPage={() => setPage((p) => Math.max(0, p - 1))}
      onNextPage={() => setPage((p) => p + 1)}
      onGoToPage={setPage}
      onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
      filters={filters}
      onFiltersChange={setFilters}
      tags={tagsMap}
      enableNameFilter
      enableTagFilter
      hideClear
      emptyMessage="You've not been assigned any staff yet"
      renderItem={(member, idx) => {
        const displayName = getStaffName(member);
        return (
          <AccordionItem
            key={member.id}
            value={member.id}
            className="animate-cascade"
            style={
              { animationDelay: `${idx * 5}ms` } as React.CSSProperties
            }
            title={
              <div className="flex flex-col min-w-0">
                <span className="truncate font-medium">
                  {displayName}
                </span>
              </div>
            }
          >
            {member.tags && member.tags.length > 0 && (
              <>
                <span className="font-medium text-[var(--foreground)]">
                  Tags:
                </span>
                <span className="font-medium pl-1">
                  {member.tags && member.tags.length > 0
                    ? member.tags
                        .map((id) => tagsMap[id] || id)
                        .join(", ")
                    : ""}
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
                    <p key={key} className="truncate break-inside-avoid">
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
      }}
    />
  );
};
