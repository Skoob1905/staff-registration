import { useCallback, useEffect, useMemo } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import type { LoginStatusValue, StaffFilters } from "../types/domain";
import { emptyFilters } from "../types/domain";

const filterMemory = new Map<string, StaffFilters>();

function hasParams(searchParams: URLSearchParams): boolean {
  return !!(searchParams.get("name") || searchParams.get("tags") || searchParams.get("agencies") || searchParams.get("types") || searchParams.get("loginStatus"));
}

export function filtersToParams(
  params: URLSearchParams,
  filters: StaffFilters,
): URLSearchParams {
  if (filters.name) params.set("name", filters.name);
  else params.delete("name");
  if (filters.tagIds.length > 0) params.set("tags", filters.tagIds.join(","));
  else params.delete("tags");
  if (filters.agencyIds.length > 0) params.set("agencies", filters.agencyIds.join(","));
  else params.delete("agencies");
  if (filters.typeIds.length > 0) params.set("types", filters.typeIds.join(","));
  else params.delete("types");
  if (filters.loginStatusFilter && filters.loginStatusFilter !== "all") params.set("loginStatus", filters.loginStatusFilter);
  else params.delete("loginStatus");
  return params;
}

function paramsToFilters(searchParams: URLSearchParams): StaffFilters {
  const name = searchParams.get("name") ?? "";
  const tags = searchParams.get("tags")?.split(",").filter(Boolean) ?? [];
  const agencies = searchParams.get("agencies")?.split(",").filter(Boolean) ?? [];
  const types = searchParams.get("types")?.split(",").filter(Boolean) ?? [];
  const loginStatusParam = searchParams.get("loginStatus");
  const loginStatusFilter: LoginStatusValue | undefined = loginStatusParam === "sent" || loginStatusParam === "not_sent" ? loginStatusParam : undefined;
  if (!name && tags.length === 0 && agencies.length === 0 && types.length === 0 && !loginStatusFilter) {
    return emptyFilters;
  }
  return { name, typeIds: types, tagIds: tags, agencyIds: agencies, loginStatusFilter };
}

export function useFilterParams(): [StaffFilters, (filters: StaffFilters) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  const filters = useMemo<StaffFilters>(() => {
    if (hasParams(searchParams)) return paramsToFilters(searchParams);
    const memory = filterMemory.get(location.pathname);
    return memory ?? paramsToFilters(searchParams);
  }, [searchParams, location.pathname]);

  const setFilters = useCallback(
    (newFilters: StaffFilters) => {
      filterMemory.set(location.pathname, newFilters);
      setSearchParams(
        (prev) => filtersToParams(new URLSearchParams(prev), newFilters),
        { replace: true },
      );
    },
    [setSearchParams, location.pathname],
  );

  useEffect(() => {
    if (hasParams(searchParams)) {
      filterMemory.set(location.pathname, paramsToFilters(searchParams));
      return;
    }
    const memory = filterMemory.get(location.pathname);
    if (memory && !hasParams(searchParams)) {
      setSearchParams(
        (prev) => filtersToParams(new URLSearchParams(prev), memory),
        { replace: true },
      );
    }
  }, [location.pathname, searchParams, setSearchParams]);

  return [filters, setFilters];
}
