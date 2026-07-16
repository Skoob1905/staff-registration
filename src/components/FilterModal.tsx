import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Checkbox,
  DialogContent,
  DialogRoot,
  DialogTitle,
  Input,
} from "./ui";
import type { Agency, FilterKeyMap, StaffFilters } from "../types/domain";
import { findValueByNormalizedKey } from "../utils/keyHeaderNormalisation";
import { getTagName } from "../utils/getTagName";
import { H1, H2, Muted } from "../config/typography";

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
}: FilterModalProps) => {
  const [name, setName] = useState(filters.name);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(
    new Set(filters.tagIds),
  );
  const [selectedAgencyNames, setSelectedAgencyNames] = useState<Set<string>>(
    new Set(filters.agencyIds),
  );

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(filters.name);
      setSelectedTagIds(new Set(filters.tagIds));
      setSelectedAgencyNames(new Set(filters.agencyIds));
    }
  }, [open, filters]);

  const tagKeys = useMemo(
    () =>
      tagCounts
        ? Object.keys(tags).filter((id) => (tagCounts[id] ?? 0) > 0)
        : Object.keys(tags),
    [tags, tagCounts],
  );

  const agencyEntries = useMemo(() => {
    if (!agencies) return [];
    return agencies.map((a) => {
      const r = a as unknown as Record<string, string>;
      const name =
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
      return { id: a.id, name };
    });
  }, [agencies]);

  const toggleTag = (id: string) => {
    const next = new Set(selectedTagIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedTagIds(next);
  };

  const toggleAgency = (name: string) => {
    const next = new Set(selectedAgencyNames);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelectedAgencyNames(next);
  };

  const handleApply = () => {
    onApply({
      name: enableName ? name.trim() : "",
      typeIds: [],
      tagIds: enableTag ? Array.from(selectedTagIds) : [],
      agencyIds: enableAgency ? Array.from(selectedAgencyNames) : [],
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
                      <Checkbox
                        key={id}
                        id={id}
                        label={getTagName(tags, id) ?? id}
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
              <H2 as="label">Agencies</H2>
              {agencyEntries.length === 0 ? (
                <Muted className="mt-1">No agencies have been assigned</Muted>
              ) : (
                <div className="mt-1 max-h-40 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-3 overflow-y-auto">
                  {agencyEntries.map(({ id, name }) => (
                    <Checkbox
                      key={id}
                      id={id}
                      label={name}
                      count={agencyCounts?.[name]}
                      checked={selectedAgencyNames.has(name)}
                      onChange={() => toggleAgency(name)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <Button type="button" onClick={handleApply}>
            Apply Filters
          </Button>
        </div>
      </DialogContent>
    </DialogRoot>
  );
};
