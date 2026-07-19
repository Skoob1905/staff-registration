import { useCallback, useEffect, useMemo } from "react";
import { useLocation, useSearchParams } from "react-router-dom";

const paginationMemory = new Map<string, { page: number; pageSize: number }>();

function hasParams(searchParams: URLSearchParams): boolean {
  return searchParams.has("page") || searchParams.has("size");
}

export function usePaginationParams(defaultPageSize = 10) {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  const params = useMemo(() => {
    if (hasParams(searchParams)) {
      const rawPage = parseInt(searchParams.get("page") ?? "1", 10);
      const page = Math.max(0, rawPage - 1);
      const pageSize = parseInt(
        searchParams.get("size") ?? String(defaultPageSize),
        10,
      );
      return { page, pageSize };
    }
    const memory = paginationMemory.get(location.pathname);
    return memory ?? { page: 0, pageSize: defaultPageSize };
  }, [searchParams, location.pathname, defaultPageSize]);

  const setPagination = useCallback(
    (newPage: number, newPageSize: number) => {
      paginationMemory.set(location.pathname, {
        page: newPage,
        pageSize: newPageSize,
      });
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("page", String(newPage + 1));
          next.set("size", String(newPageSize));
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams, location.pathname],
  );

  const setPage = useCallback(
    (newPage: number) => setPagination(newPage, params.pageSize),
    [setPagination, params.pageSize],
  );

  const setPageSize = useCallback(
    (newSize: number) => setPagination(0, newSize),
    [setPagination],
  );

  useEffect(() => {
    if (hasParams(searchParams)) {
      const rawPage = parseInt(searchParams.get("page") ?? "1", 10);
      const page = Math.max(0, rawPage - 1);
      const pageSize = parseInt(
        searchParams.get("size") ?? String(defaultPageSize),
        10,
      );
      paginationMemory.set(location.pathname, { page, pageSize });
      return;
    }
    const memory = paginationMemory.get(location.pathname);
    const page = memory?.page ?? 0;
    const pageSize = memory?.pageSize ?? defaultPageSize;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("page", String(page + 1));
        next.set("size", String(pageSize));
        return next;
      },
      { replace: true },
    );
  }, [location.pathname, searchParams, setSearchParams, defaultPageSize]);

  return { page: params.page, pageSize: params.pageSize, setPage, setPageSize };
}
