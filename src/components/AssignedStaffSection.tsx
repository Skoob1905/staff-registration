import { useEffect, useMemo, useState } from "react";
import { AccordionItem, AccordionRoot } from "./ui";
import { useAuth } from "../context/AuthProvider";
import { useAppStore } from "../stores/appStore";
import { formatInvitedAt } from "../utils/date";
import { FilterView } from "./FilterView";
import { usePaginatedStaff } from "../hooks/usePaginatedStaff";
import type { StaffFilters } from "../types/domain";
import { emptyFilters } from "../types/domain";
import { getStaffName } from "../utils/staff";

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

  const [filters, setFilters] = useState<StaffFilters>(emptyFilters);

  const pagination = usePaginatedStaff({
    agencyId: currentAgencyId ?? "",
    filters,
    pageSize: 50,
    assignedToId,
  });

  useEffect(() => {
    loadTags().catch(() => {});
  }, [loadTags]);

  return (
    <FilterView
      title="Assigned Staff"
      items={pagination.items}
      filters={filters}
      onFiltersChange={setFilters}
      searchFields={["Forename", "Surname", "FullName", "email"]}
      tags={tagsMap}
      enableNameFilter
      enableTagFilter
      hideClear
      emptyMessage="You've not been assigned any staff yet"
      pagination
      currentPage={pagination.currentPage}
      totalPages={pagination.totalPages}
      totalCount={pagination.totalCount}
      pageSize={pagination.pageSize}
      loading={pagination.loading}
      onPrevPage={pagination.goPrev}
      onNextPage={pagination.goNext}
      onGoToPage={pagination.goToPage}
      onPageSizeChange={pagination.setPageSize}
    >
      {(filtered) => (
        <div className="overflow-hidden rounded-xl border border-[var(--border)]">
          <AccordionRoot type="single" collapsible>
            {filtered.map((member, idx) => {
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
            })}
          </AccordionRoot>
        </div>
      )}
    </FilterView>
  );
};
