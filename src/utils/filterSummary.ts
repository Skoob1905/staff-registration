import type { Agency, StaffFilters } from "../types/domain";
import { findValueByNormalizedKey } from "./keyHeaderNormalisation";

const DEFAULT_MIN_NAME_LENGTH = 3;

export interface FilterSummarySources {
  /** tag id -> display name */
  tags?: Record<string, string>;
  /** agency id -> display name */
  agencies?: Record<string, string>;
}

export interface FilterSummaryOptions {
  includeName?: boolean;
  includeTags?: boolean;
  includeAgencies?: boolean;
  minNameLength?: number;
}

/**
 * Builds a short, comma-separated summary of the active filters, e.g.
 * `"jane, Driver, Acme Corp"`. Values fall back to the raw id when no
 * display name can be resolved.
 */
export function buildFilterSummary(
  filters: StaffFilters,
  sources: FilterSummarySources = {},
  options: FilterSummaryOptions = {},
): string {
  const {
    includeName = true,
    includeTags = true,
    includeAgencies = true,
    minNameLength = DEFAULT_MIN_NAME_LENGTH,
  } = options;

  const parts: string[] = [];

  const search = filters.name.trim();
  if (includeName && search.length >= minNameLength) parts.push(search);

  if (includeTags) {
    for (const id of filters.tagIds) parts.push(sources.tags?.[id] ?? id);
  }

  if (includeAgencies) {
    for (const id of filters.agencyIds) {
      parts.push(sources.agencies?.[id] ?? id);
    }
  }

  return parts.join(", ");
}

/**
 * Resolves a display name for each agency, tolerating the various field
 * names used across CSV imports.
 */
export function buildAgencyNameMap(
  agencies?: Agency[],
): Record<string, string> {
  const map: Record<string, string> = {};
  if (!agencies) return map;

  for (const a of agencies) {
    const r = a as unknown as Record<string, string>;
    map[a.id] =
      a.name ||
      r.business_name ||
      r.Company_Name ||
      r.company_name ||
      r.name ||
      r.agencyName ||
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
}
