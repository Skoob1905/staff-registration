import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Checkbox,
  DialogContent,
  DialogRoot,
  DialogTitle,
  Input,
} from "../../components/ui";
import type { Agency, FilterKeyMap, StaffFilters } from "../../types/domain";
import { findValueByNormalizedKey } from "../../utils/keyHeaderNormalisation";
import { H1, H2, Muted } from "../../config/typography";

interface FilterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filterKeys?: FilterKeyMap;
  agencies?: Agency[];
  agencyCounts?: Record<string, number>;
  filters: StaffFilters;
  onApply: (filters: StaffFilters) => void;
  tags?: Record<string, string>;
  tagCounts?: Record<string, number>;
  enableName?: boolean;
  enableTag?: boolean;
  enableAgency?: boolean;
  nameLabel?: string;
  showAllTags?: boolean;
}

export const FilterModal = ({
  open,
  onOpenChange,
  agencies,
  agencyCounts,
  filters,
  onApply,
  tags = {},
  tagCounts,
  enableName = true,
  enableTag = false,
  enableAgency = false,
  nameLabel = "Name",
  showAllTags = false,
}: FilterModalProps) => {
  const [name, setName] = useState(filters.name);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(
    new Set(filters.tagIds),
  );
  const [selectedAgencyIds, setSelectedAgencyIds] = useState<Set<string>>(
    new Set(filters.agencyIds),
  );

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(filters.name);
      setSelectedTagIds(new Set(filters.tagIds));
      setSelectedAgencyIds(new Set(filters.agencyIds));
    }
  }, [open, filters]);

  const tagKeys = useMemo(
    () =>
      showAllTags
        ? Object.keys(tags)
        : tagCounts
          ? Object.keys(tags).filter((id) => (tagCounts[id] ?? 0) > 0)
          : Object.keys(tags),
    [tags, tagCounts, showAllTags],
  );

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

  const nextFilters: StaffFilters = {
    name: enableName ? name.trim() : "",
    typeIds: [],
    tagIds: enableTag ? Array.from(selectedTagIds) : [],
    agencyIds: enableAgency ? Array.from(selectedAgencyIds) : [],
  };

  const sameSet = (a: string[], b: string[]) => {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((value, i) => value === sortedB[i]);
  };

  const hasChanges =
    nextFilters.name !== filters.name ||
    !sameSet(nextFilters.tagIds, filters.tagIds) ||
    !sameSet(nextFilters.agencyIds, filters.agencyIds);

  const commit = () => {
    if (hasChanges) onApply(nextFilters);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    commit();
    onOpenChange(false);
  };

  const handleClose = () => {
    commit();
    onOpenChange(false);
  };

  return (
    <DialogRoot
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
        else onOpenChange(true);
      }}
    >
      <DialogContent onClose={handleClose}>
        <form onSubmit={handleSubmit}>
          <DialogTitle asChild>
            <H1>Filter</H1>
          </DialogTitle>

          <div className="mt-4 space-y-4">
            {enableName && (
              <div>
                <H2 as="label">{nameLabel}</H2>
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
                      <Muted>No tags matching this name</Muted>
                    ) : (
                      tagKeys.map((id) => (
                        <Checkbox
                          key={id}
                          id={id}
                          label={tags[id]}
                          count={tagCounts?.[id]}
                          checked={selectedTagIds.has(id)}
                          onChange={() => toggleTag(id)}
                        />
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
                      <Checkbox
                        key={id}
                        id={id}
                        label={name}
                        count={agencyCounts?.[id]}
                        checked={selectedAgencyIds.has(id)}
                        onChange={() => toggleAgency(id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end">
            <Button type="submit">Apply Filters</Button>
          </div>
        </form>
      </DialogContent>
    </DialogRoot>
  );
};
