import { useMemo } from "react";
import { useAuth } from "../context/AuthProvider";
import { usePaginatedRecords } from "./usePaginatedRecords";
import { getAgencyName } from "../utils/agency";

const AGENCIES_INDEX = "agencies_name_desc";

export interface AgencyOption {
  id: string;
  name: string;
}

interface UseAgenciesParams {
  enabled?: boolean;
}

export function useAgencies({ enabled = true }: UseAgenciesParams = {}) {
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === "admin" || appUser?.role === "super";

  const facetFilters = useMemo(
    () => (isAdmin ? [] : [[`metadata.uploadedBy:${appUser?.agencyId ?? ""}`]]),
    [isAdmin, appUser?.agencyId],
  );

  const { items, loading } = usePaginatedRecords<Record<string, unknown>>({
    indexName: AGENCIES_INDEX,
    agencyId: isAdmin ? "all" : (appUser?.agencyId ?? ""),
    facetFilters,
    hitsPerPage: 1000,
    enabled,
  });

  const agencies = useMemo<AgencyOption[]>(
    () =>
      items
        .map((item) => ({
          id: String(item.id ?? ""),
          name: getAgencyName(item),
        }))
        .filter((agency) => agency.id && agency.name !== "Unknown"),
    [items],
  );

  return { agencies, loading };
}
