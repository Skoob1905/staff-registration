import { useEffect, useMemo, useState } from "react";
import { DialogContent, DialogRoot, DialogTitle } from "./ui/dialog";
import { Button, Input } from "./ui";
import type { Agency, StaffFilters, StaffType } from "../types/domain";
import { findValueByNormalizedKey } from "../utils/staff";

interface StaffFilterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agencies?: Agency[];
  filters: StaffFilters;
  onApply: (filters: StaffFilters) => void;
  tags?: Record<string, string>;
  staffTypes?: StaffType[];
  enableName?: boolean;
  enableType?: boolean;
  enableTag?: boolean;
  enableAgency?: boolean;
  hideClear?: boolean;
}

export const StaffFilterModal = ({
  open,
  onOpenChange,
  agencies,
  filters,
  onApply,
  tags = {},
  staffTypes = [],
  enableName = true,
  enableType = false,
  enableTag = false,
  enableAgency = false,
  hideClear = false,
}: StaffFilterModalProps) => {
  const [name, setName] = useState(filters.name);
  const [selectedTypeIds, setSelectedTypeIds] = useState<Set<string>>(
    new Set(filters.typeIds),
  );
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(
    new Set(filters.tagIds),
  );
  const [selectedAgencyIds, setSelectedAgencyIds] = useState<Set<string>>(
    new Set(filters.agencyIds),
  );

  useEffect(() => {
    if (open) {
      setName(filters.name);
      setSelectedTypeIds(new Set(filters.typeIds));
      setSelectedTagIds(new Set(filters.tagIds));
      setSelectedAgencyIds(new Set(filters.agencyIds));
    }
  }, [open, filters]);

  const tagKeys = useMemo(() => Object.keys(tags), [tags]);

  const agencyList = useMemo(() => {
    if (!agencies) return [];
    const map: Record<string, string> = {};
    for (const a of agencies) {
      const r = a as unknown as Record<string, string>;
      map[a.id] =
        a.name ||
        r.business_name ||
        r.Company_Name ||
        r.company_name ||
        r.name ||
        findValueByNormalizedKey(
          r,
          "businessname",
          "name",
          "agencyname",
          "organisation",
          "company",
        ) ||
        "Unknown";
    }
    return map;
  }, [agencies]);

  const toggleType = (id: string) => {
    const next = new Set(selectedTypeIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedTypeIds(next);
  };

  const toggleTag = (id: string) => {
    const next = new Set(selectedTagIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedTagIds(next);
  };

  const toggleAgency = (id: string) => {
    const next = new Set(selectedAgencyIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedAgencyIds(next);
  };

  const handleApply = () => {
    onApply({
      name: enableName ? name.trim() : "",
      typeIds: enableType ? Array.from(selectedTypeIds) : [],
      tagIds: enableTag ? Array.from(selectedTagIds) : [],
      agencyIds: enableAgency ? Array.from(selectedAgencyIds) : [],
    });
    onOpenChange(false);
  };

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogTitle className="text-base sm:text-lg font-bold">
          Filter
        </DialogTitle>

        <div className="mt-4 space-y-4">
          {/* {enableName && (
            <div>
              <label className="text-sm sm:text-base font-bold text-[var(--foreground)]">
                Name
              </label>
              <Input
                className="mt-1"
                placeholder="Type at least 3 characters..."
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )} */}

          {enableTag && (
            <div>
              <label className="text-sm sm:text-base font-bold text-[var(--foreground)]">
                Tags
              </label>
              {Object.keys(tags).length === 0 ? (
                <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">
                  No tags have been assigned
                </p>
              ) : (
                <div className="mt-1 max-h-40 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-3 overflow-y-auto">
                  {tagKeys.length === 0 ? (
                    <p className="text-xs sm:text-sm text-[var(--muted-foreground)]">
                      No tags have been assigned
                    </p>
                  ) : (
                    tagKeys.map((id) => (
                      <label
                        key={id}
                        className="flex cursor-pointer items-center gap-2 text-xs sm:text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTagIds.has(id)}
                          onChange={() => toggleTag(id)}
                          className="rounded shrink-0"
                        />
                        <span className="truncate">{tags[id]}</span>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {enableAgency && (
            <div>
              <label className="text-sm sm:text-base font-bold text-[var(--foreground)]">
                Clients
              </label>
              {Object.keys(agencyList).length === 0 ? (
                <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">
                  No clients have been assigned
                </p>
              ) : (
                <div className="mt-1 max-h-40 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-3 overflow-y-auto">
                  {Object.entries(agencyList).map(([id, name]) => (
                    <label
                      key={id}
                      className="flex cursor-pointer items-center gap-2 text-xs sm:text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedAgencyIds.has(id)}
                        onChange={() => toggleAgency(id)}
                        className="rounded shrink-0"
                      />
                      <span className="truncate">{name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          {!hideClear && (
            <Button
              type="button"
              className="border border-[var(--border)] bg-transparent text-[var(--foreground)] shadow-none hover:bg-[color:rgba(0,95,87,0.06)]"
              onClick={() => {
                setName("");
                setSelectedTypeIds(new Set());
                setSelectedTagIds(new Set());
                setSelectedAgencyIds(new Set());
              }}
            >
              Clear
            </Button>
          )}
          <Button type="button" onClick={handleApply}>
            Apply Filters
          </Button>
        </div>
      </DialogContent>
    </DialogRoot>
  );
};
