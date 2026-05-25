import { useEffect, useMemo, useState } from "react";
import { DialogContent, DialogRoot, DialogTitle } from "./ui/dialog";
import { Button, Input } from "./ui";
import type { Agency, StaffFilters, StaffType } from "../types/domain";

interface StaffFilterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agencies?: Agency[];
  items: Record<string, unknown>[];
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
  items,
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

  const typeCounts = useMemo(() => {
    if (!enableType) return new Map<string, number>();
    const counts = new Map<string, number>();
    for (const s of items) {
      const ids = s.typeIds as string[] | undefined;
      if (ids) {
        for (const t of ids) {
          counts.set(t, (counts.get(t) || 0) + 1);
        }
      }
    }
    return counts;
  }, [items, enableType]);

  const tagCounts = useMemo(() => {
    if (!enableTag) return new Map<string, number>();
    const counts = new Map<string, number>();
    for (const s of items) {
      const ids = s.tags as string[] | undefined;
      if (ids) {
        for (const t of ids) {
          counts.set(t, (counts.get(t) || 0) + 1);
        }
      }
    }
    return counts;
  }, [items, enableTag]);

  const agencyCounts = useMemo(() => {
    if (!enableAgency) return new Map<string, number>();
    const counts = new Map<string, number>();
    for (const s of items) {
      const meta = s.metadata as { assignedToId?: string } | undefined;
      if (meta?.assignedToId) {
        counts.set(meta.assignedToId, (counts.get(meta.assignedToId) || 0) + 1);
      }
    }
    return counts;
  }, [items, enableAgency]);

  const agencyMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (!agencies) return map;
    for (const a of agencies) {
      const r = a as unknown as Record<string, string>;
      map[a.id] = a.name || r.business_name || r.Company_Name || r.company_name || r.name || "Unknown";
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
        <DialogTitle className="text-sm sm:text-lg font-bold">Filter</DialogTitle>

        <div className="mt-4 space-y-4">
          {enableName && (
            <div>
              <label className="text-xs sm:text-sm font-medium text-[var(--muted-foreground)]">
                Name
              </label>
              <Input
                className="mt-1"
                placeholder="Type at least 3 characters..."
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}

          {enableType && (
            <div>
              <label className="text-xs sm:text-sm font-medium text-[var(--muted-foreground)]">
                Type
              </label>
              {staffTypes.length === 0 ? (
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  No types available
                </p>
              ) : (
                <div className="mt-1 max-h-40 space-y-1 overflow-y-auto">
                  {staffTypes.map((t) => (
                    <label
                      key={t.id}
                      className="flex cursor-pointer items-center gap-2 text-xs sm:text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTypeIds.has(t.id)}
                        onChange={() => toggleType(t.id)}
                        className="rounded"
                      />
                      <span>{t.name}</span>
                      <span className="text-xs text-[var(--muted-foreground)]">
                        ({typeCounts.get(t.id) || 0})
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {enableTag && (
            <div>
              <label className="text-xs sm:text-sm font-medium text-[var(--muted-foreground)]">
                Tags
              </label>
              {Object.keys(tags).length === 0 ? (
                <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">
                  No tags have been assigned
                </p>
              ) : (
                <div className="mt-1 max-h-40 space-y-1 overflow-y-auto">
                  {Object.entries(tags).filter(([id]) => (tagCounts.get(id) || 0) > 0).map(([id, value]) => (
                    <label
                      key={id}
                      className="flex cursor-pointer items-center gap-2 text-xs sm:text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTagIds.has(id)}
                        onChange={() => toggleTag(id)}
                        className="rounded"
                      />
                      <span>{value}</span>
                      <span className="text-xs text-[var(--muted-foreground)]">
                        ({tagCounts.get(id) || 0})
                      </span>
                    </label>
                  ))}
                  {Object.entries(tags).filter(([id]) => (tagCounts.get(id) || 0) > 0).length === 0 && (
                    <p className="text-xs sm:text-sm text-[var(--muted-foreground)]">
                      No tags have been assigned
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {enableAgency && (
            <div>
              <label className="text-xs sm:text-sm font-medium text-[var(--muted-foreground)]">
                Clients
              </label>
              {agencyCounts.size === 0 ? (
                <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">
                  No clients have been assigned
                </p>
              ) : (
                <div className="mt-1 max-h-40 space-y-1 overflow-y-auto">
                  {Array.from(agencyCounts.entries())
                    .filter(([, count]) => count > 0)
                    .map(([id, count]) => (
                      <label
                        key={id}
                        className="flex cursor-pointer items-center gap-2 text-xs sm:text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={selectedAgencyIds.has(id)}
                          onChange={() => toggleAgency(id)}
                          className="rounded"
                        />
                        <span>{agencyMap[id] || id}</span>
                        <span className="text-xs text-[var(--muted-foreground)]">
                          ({count})
                        </span>
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
