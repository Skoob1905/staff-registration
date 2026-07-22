import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Checkbox,
  DialogContent,
  DialogRoot,
  DialogTitle,
  Input,
} from "./ui";
import type { Agency, FilterKeyMap, LoginStatusValue, StaffFilters } from "../types/domain";
import { getAgencyName } from "../utils/agency";
import { getTagName } from "../utils/getTagName";
import { H1, H2, Muted } from "../config/typography";
import { IsLoggedIn } from "./filters/IsLoggedIn";

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
  enableLoginStatus?: boolean;
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
  enableLoginStatus = false,
}: FilterModalProps) => {
  const [name, setName] = useState(filters.name);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(
    new Set(filters.tagIds),
  );
  const [selectedAgencyIds, setSelectedAgencyIds] = useState<Set<string>>(
    new Set(filters.agencyIds),
  );
  const [loginStatusValue, setLoginStatusValue] = useState<LoginStatusValue>(
    filters.loginStatusFilter ?? "all",
  );

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(filters.name);
      setSelectedTagIds(new Set(filters.tagIds));
      setSelectedAgencyIds(new Set(filters.agencyIds));
      setLoginStatusValue(filters.loginStatusFilter ?? "all");
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
      const r = a as unknown as Record<string, unknown>;
      return { id: a.id, name: getAgencyName(r) };
    });
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
      typeIds: [],
      tagIds: enableTag ? Array.from(selectedTagIds) : [],
      agencyIds: enableAgency ? Array.from(selectedAgencyIds) : [],
      loginStatusFilter: enableLoginStatus ? loginStatusValue : undefined,
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
                      count={agencyCounts?.[id]}
                      checked={selectedAgencyIds.has(id)}
                      onChange={() => toggleAgency(id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {enableLoginStatus && (
            <div>
              <H2 as="label">Login Status</H2>
              <div className="mt-2">
                <IsLoggedIn
                  value={loginStatusValue}
                  onChange={setLoginStatusValue}
                />
              </div>
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
