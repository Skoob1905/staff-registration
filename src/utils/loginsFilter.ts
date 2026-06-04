import type { StaffFilters, FilterKeyMap } from "../types/domain";

export function buildFacetFilters(
  filters: StaffFilters,
  keyMap: FilterKeyMap,
): string[][] {
  const ffs: string[][] = [];
  for (const id of filters.tagIds) {
    ffs.push([`${keyMap.tag}:${id}`]);
  }
  if (filters.agencyIds.length > 0) {
    ffs.push(filters.agencyIds.map((id) => `${keyMap.agency}:${id}`));
  }
  return ffs;
}

export function buildFacetRequestFields(keyMap: FilterKeyMap): string[] {
  return [keyMap.tag, keyMap.agency].filter(Boolean);
}
