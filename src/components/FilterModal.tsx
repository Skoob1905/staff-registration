import { useEffect, useMemo, useState } from "react";
import { Button, DialogContent, DialogRoot, DialogTitle, Input } from "./ui";
import type { Agency, StaffFilters, StaffType } from "../types/domain";
import { findValueByNormalizedKey } from "../utils/keyHeaderNormalisation";
import { H1, H2, Muted } from "../config/typography";

interface FilterModalProps {
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

export const FilterModal = ({
  open,
  onOpenChange,
  agencies,
  filters,
  onApply,
  tags = {},
  enableName = true,
  enableType = false,
  enableTag = false,
  enableAgency = false,
  hideClear = false,
}: FilterModalProps) => {
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
        <DialogTitle asChild>
          <H1>Filter</H1>
        </DialogTitle>

        <div className="mt-4 space-y-4">
          {enableName && (
            <div>
              <H2 as="label">Name</H2>
              <Input
                className="mt-1"
                placeholder="Type at least 3 characters..."
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}

          {enableTag && (
            <div>
              <H2 as="label">Tags</H2>
              {Object.keys(tags).length === 0 ? (
                <Muted className="mt-1">No tags have been assigned</Muted>
              ) : (
                <div className="mt-1 max-h-40 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-3 overflow-y-auto">
                  {tagKeys.length === 0 ? (
                    <Muted>No tags have been assigned</Muted>
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
              <H2 as="label">Clients</H2>
              {Object.keys(agencyList).length === 0 ? (
                <Muted className="mt-1">No clients have been assigned</Muted>
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
