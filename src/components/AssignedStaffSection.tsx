import { useEffect, useMemo, useState } from "react";
import { AccordionItem, AccordionRoot } from "./ui";
import { useAuth } from "../context/AuthProvider";
import { useAppStore } from "../stores/appStore";
import { formatInvitedAt } from "../utils/date";
import { FilterView } from "./FilterView";
import type { StaffFilters } from "../types/domain";
import { emptyFilters } from "../types/domain";

interface AssignedStaffSectionProps {
  targetAgencyId?: string;
}

export const AssignedStaffSection = ({
  targetAgencyId,
}: AssignedStaffSectionProps) => {
  const { appUser } = useAuth();
  const agencyId = targetAgencyId || appUser?.agencyId;

  const assignedStaff = useAppStore((s) => s.assignedStaff);
  const loadAssignedStaff = useAppStore((s) => s.loadAssignedStaff);
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

  useEffect(() => {
    if (!agencyId) return;
    loadAssignedStaff(agencyId).catch(() => {});
  }, [agencyId, loadAssignedStaff]);

  useEffect(() => {
    loadTags().catch(() => {});
  }, [loadTags]);

  const sortedStaff = useMemo(
    () =>
      [...assignedStaff].sort((a, b) =>
        (a.Forename || "").localeCompare(b.Forename || ""),
      ),
    [assignedStaff],
  );

  return (
    <FilterView
      title="Assigned Staff"
      items={sortedStaff}
      filters={filters}
      onFiltersChange={setFilters}
      searchFields={["fullName", "Forename", "Surname", "email"]}
      tags={tagsMap}
      enableNameFilter
      enableTagFilter
      hideClear
      emptyMessage="You've not been assigned any staff yet"
    >
      {(filtered) => (
        <div className="overflow-hidden rounded-xl border border-[var(--border)]">
          <AccordionRoot type="single" collapsible>
            {filtered.map((member) => {
              const displayName =
                [member.Title, member.Forename, member.Surname]
                  .filter(Boolean)
                  .join(" ") || member.email;
              return (
                <AccordionItem
                  key={member.id}
                  value={member.id}
                  title={
                    <div className="flex flex-col min-w-0">
                      <span className="truncate font-medium pr-4">{displayName}</span>
                    </div>
                  }
                  actions={
                    member.tags && member.tags.length > 0 ? (
                      <span className="text-xs sm:text-sm font-medium text-zinc-600 overflow-x-auto [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] whitespace-nowrap">
                        {member.tags.map((id) => tagsMap[id] || id).join(", ")}
                      </span>
                    ) : undefined
                  }
                >
                  {member.metadata?.assignedBy ? (
                    <span className="text-xs sm:text-sm text-[var(--muted-foreground)]">
                      <span className="font-medium text-[var(--foreground)]">
                        Assigned by:{" "}
                      </span>
                      {member.metadata.assignedBy}
                      {member.metadata.assignedAt
                        ? ` ${formatInvitedAt(member.metadata.assignedAt)}`
                        : ""}
                    </span>
                  ) : null}
                  <div className="columns-2 gap-x-4 text-xs sm:text-sm text-zinc-600 mt-2">
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
                            <span className="font-medium text-[var(--foreground)]">{key}</span><span className="font-medium">: {display}</span>
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
