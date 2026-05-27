import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DocumentData } from "firebase/firestore";
import {
  collection,
  documentId,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
} from "firebase/firestore";
import { db } from "../services/firebase";
import { useAppStore } from "../stores/appStore";
import type { BulkStaff, StaffFilters } from "../types/domain";

interface UsePaginatedStaffParams {
  agencyId: string;
  filters: StaffFilters;
  pageSize: number;
  assignedToId?: string;
}

interface UsePaginatedStaffResult {
  items: BulkStaff[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  loading: boolean;
  goNext: () => void;
  goPrev: () => void;
  goToPage: (page: number) => void;
  setPageSize: (size: number) => void;
  refresh: () => void;
}

const computeCacheKey = (
  agencyId: string,
  assignedToId: string | undefined,
  pageSize: number,
  tagIds: string[],
  agencyIds: string[],
): string =>
  JSON.stringify([
    agencyId,
    assignedToId ?? null,
    pageSize,
    ...tagIds.slice().sort(),
    ...agencyIds.slice().sort(),
  ]);

const applyNameFilter = (items: BulkStaff[], name: string): BulkStaff[] => {
  if (!name || name.length < 3) return items;
  const q = name.toLowerCase();
  return items.filter(
    (s) => (s.Forename?.toLowerCase() ?? "").includes(q),
  );
};

const describeConstraints = (c: unknown[]): string => {
  const parts: string[] = [];
  for (const item of c) {
    if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      if (obj.type === "where") {
        const field = (obj._field as { key?: string })?.key ?? "?";
        const op = String(obj._op ?? "?");
        const val = obj._value;
        parts.push(`where(${field} ${op} ${JSON.stringify(val)})`);
      } else if (obj.type === "orderBy") {
        const field = (obj._field as { key?: string })?.key ?? "?";
        const dir = String(obj._direction ?? "asc");
        parts.push(`orderBy(${field}, ${dir})`);
      } else if (obj.type === "limit") {
        parts.push(`limit(${obj._limit})`);
      } else if (obj.type === "startAt") {
        parts.push(`startAfter(...)`);
      } else if (obj._queryOptions) {
        const segments = (obj._queryOptions as { collectionGroup?: string; fields?: unknown[] })?.collectionGroup ?? "?";
        parts.push(`collection(${segments})`);
      }
    }
  }
  return parts.join(", ");
};

const buildQueryConstraints = (
  assignedToId: string | undefined,
  tagIds: string[],
  agencyIds: string[],
  pageSize: number,
  cursor?: string | null,
) => {
  const c: unknown[] = [collection(db, "staff")];

  if (assignedToId) {
    c.push(where("metadata.assignedToId", "==", assignedToId));
  }

  const canFilterTags = tagIds.length > 0 && tagIds.length <= 10;
  const canFilterAgencies =
    agencyIds.length > 0 && agencyIds.length <= 10 && !assignedToId;
  const bothActive = canFilterTags && canFilterAgencies;

  if (canFilterTags && !bothActive) {
    c.push(where("tags", "array-contains-any", tagIds));
  }

  if (canFilterAgencies && !bothActive) {
    c.push(where("metadata.assignedToId", "in", agencyIds));
  }

  if (bothActive) {
    console.warn(
      "[usePaginatedStaff] tag + agency filters active — can't combine array-contains-any and in; agency filter applied client-side",
    );
  }

  c.push(orderBy(documentId()));

  if (cursor) {
    c.push(startAfter(cursor));
  }

  c.push(limit(pageSize));
  console.log("[usePaginatedStaff] buildQueryConstraints:", describeConstraints(c));
  return c;
};

const countQuery = (
  assignedToId: string | undefined,
  tagIds: string[],
  agencyIds: string[],
) => {
  const c: unknown[] = [collection(db, "staff")];

  if (assignedToId) {
    c.push(where("metadata.assignedToId", "==", assignedToId));
  }

  const canFilterTags = tagIds.length > 0 && tagIds.length <= 10;
  const canFilterAgencies =
    agencyIds.length > 0 && agencyIds.length <= 10 && !assignedToId;
  const bothActive = canFilterTags && canFilterAgencies;

  if (canFilterTags) {
    c.push(where("tags", "array-contains-any", tagIds));
  }

  if (canFilterAgencies && !bothActive) {
    c.push(where("metadata.assignedToId", "in", agencyIds));
  }

  console.log("[usePaginatedStaff] countQuery:", describeConstraints(c));
  return c;
};

export const usePaginatedStaff = ({
  agencyId,
  filters,
  pageSize: initialPageSize,
  assignedToId,
}: UsePaginatedStaffParams): UsePaginatedStaffResult => {
  const [pageSize, setPageSize] = useState(initialPageSize);

  const cacheKey = useMemo(
    () =>
      computeCacheKey(
        agencyId,
        assignedToId,
        pageSize,
        filters.tagIds,
        filters.agencyIds,
      ),
    [agencyId, assignedToId, pageSize, filters.tagIds, filters.agencyIds],
  );

  const cache = useAppStore((s) => s.paginationCache[cacheKey]);
  const setPaginationPage = useAppStore((s) => s.setPaginationPage);
  const setPaginationMeta = useAppStore((s) => s.setPaginationMeta);
  const clearPaginationCache = useAppStore((s) => s.clearPaginationCache);
  const cancelledRef = useRef(false);

  const [currentPage, setCurrentPageState] = useState(cache?.currentPage ?? 1);

  const setCurrentPage = useCallback(
    (page: number | ((p: number) => number)) => {
      setCurrentPageState(page);
    },
    [],
  );

  useEffect(() => {
    useAppStore.getState().setPaginationMeta(cacheKey, { currentPage });
  }, [cacheKey, currentPage]);
  const loading = cache?.loading ?? true;
  const totalCount = cache?.totalCount ?? 0;
  const currentPageData = cache?.pages[currentPage];

  const rawItems = currentPageData?.items ?? [];
  const items = useMemo(() => {
    let result = applyNameFilter(rawItems, filters.name);

    const canFilterTags =
      filters.tagIds.length > 0 && filters.tagIds.length <= 10;
    const canFilterAgencies =
      filters.agencyIds.length > 0 && filters.agencyIds.length <= 10;
    const bothActive = canFilterTags && canFilterAgencies;

    if (bothActive) {
      if (filters.agencyIds.length > 0) {
        const agencySet = new Set(filters.agencyIds);
        result = result.filter(
          (s) =>
            s.metadata?.assignedToId && agencySet.has(s.metadata.assignedToId),
        );
      }
      if (filters.tagIds.length > 0) {
        const tagSet = new Set(filters.tagIds);
        result = result.filter((s) => s.tags?.some((t) => tagSet.has(t)));
      }
    } else {
      if (canFilterTags) {
        const tagSet = new Set(filters.tagIds);
        result = result.filter((s) => s.tags?.some((t) => tagSet.has(t)));
      }
      if (canFilterAgencies) {
        const agencySet = new Set(filters.agencyIds);
        result = result.filter(
          (s) =>
            s.metadata?.assignedToId && agencySet.has(s.metadata.assignedToId),
        );
      }
    }

    if (filters.tagIds.length > 10) {
      const tagSet = new Set(filters.tagIds);
      result = result.filter((s) => s.tags?.some((t) => tagSet.has(t)));
    }

    if (filters.agencyIds.length > 10) {
      const agencySet = new Set(filters.agencyIds);
      result = result.filter(
        (s) =>
          s.metadata?.assignedToId && agencySet.has(s.metadata.assignedToId),
      );
    }

    return result;
  }, [rawItems, filters.name, filters.tagIds, filters.agencyIds]);

  const displayTotalCount = items.length === 0 && !loading ? 0 : totalCount;

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(displayTotalCount / pageSize)),
    [displayTotalCount, pageSize],
  );

  const fetchPage = useCallback(
    async (pageNum: number) => {
      const store = useAppStore.getState();
      const entry = store.paginationCache[cacheKey];

      if (pageNum === 1) {
        console.log("[usePaginatedStaff] ===== fetchPage(1) called =====", { agencyId, assignedToId, tagIds: filters.tagIds, agencyIds: filters.agencyIds, pageSize, cacheKey });
        setPaginationMeta(cacheKey, { loading: true, totalCount: 0 });
        cancelledRef.current = false;

        try {
          const countC = countQuery(
            assignedToId,
            filters.tagIds,
            filters.agencyIds,
          );
          const countQ = query(...(countC as Parameters<typeof query>));
          const countSnap = await getCountFromServer(countQ);
          console.log("[usePaginatedStaff] count result:", countSnap.data().count);
          if (cancelledRef.current) return;
          setPaginationMeta(cacheKey, {
            totalCount: countSnap.data().count,
          });
        } catch (err) {
          console.error("[usePaginatedStaff] count failed:", err);
        }

        try {
          const pageC = buildQueryConstraints(
            assignedToId,
            filters.tagIds,
            filters.agencyIds,
            pageSize,
          );
          const q = query(...(pageC as Parameters<typeof query>));
          console.log("[usePaginatedStaff] executing page 1 query");
          const snap = await getDocs(q);
          const data = (d: { data: () => unknown }) => d.data() as DocumentData;
          console.log("[usePaginatedStaff] page 1 returned docs:", snap.docs.length, snap.docs.map(d => ({ id: d.id, forename: data(d).Forename, surname: data(d).Surname, email: data(d).email, agencyId: data(d).agencyId })));
          if (cancelledRef.current) return;

          const docs = snap.docs.map(
            (d) => ({ id: d.id, ...data(d) }) as BulkStaff,
          );
          const lastCursor =
            docs.length > 0 ? docs[docs.length - 1].id : null;

          setPaginationPage(cacheKey, 1, docs, lastCursor);
          setPaginationMeta(cacheKey, { currentPage: 1 });
        } catch (err) {
          console.error("[usePaginatedStaff] page 1 failed:", err);
        } finally {
          if (!cancelledRef.current) {
            setPaginationMeta(cacheKey, { loading: false });
          }
        }
        return;
      }

      const prevPage = entry?.pages[pageNum - 1];
      if (!prevPage?.lastCursor) return;

      setPaginationMeta(cacheKey, { loading: true });

      try {
        const pageC = buildQueryConstraints(
          assignedToId,
          filters.tagIds,
          filters.agencyIds,
          pageSize,
          prevPage.lastCursor,
        );
        const q = query(...(pageC as Parameters<typeof query>));
        console.log(`[usePaginatedStaff] executing page ${pageNum} query`);
        const snap = await getDocs(q);
        const data = (d: { data: () => unknown }) => d.data() as DocumentData;
        console.log(`[usePaginatedStaff] page ${pageNum} returned docs:`, snap.docs.length, snap.docs.map(d => ({ id: d.id, forename: data(d).Forename, surname: data(d).Surname, email: data(d).email, agencyId: data(d).agencyId })));
        if (cancelledRef.current) return;

        const docs = snap.docs.map(
          (d) => ({ id: d.id, ...data(d) }) as BulkStaff,
        );
        const lastCursor =
          docs.length > 0 ? docs[docs.length - 1].id : null;

        setPaginationPage(cacheKey, pageNum, docs, lastCursor);
      } catch (err) {
        console.error(`[usePaginatedStaff] page ${pageNum} failed:`, err);
      } finally {
        if (!cancelledRef.current) {
          setPaginationMeta(cacheKey, { loading: false });
        }
      }
    },
    [
      agencyId,
      assignedToId,
      cacheKey,
      filters.tagIds,
      filters.agencyIds,
      pageSize,
    ],
  );

  useEffect(() => {
    if (!agencyId) return;
    cancelledRef.current = false;

    const store = useAppStore.getState();
    const existing = store.paginationCache[cacheKey];

    if (existing) {
      setCurrentPage(existing.currentPage);
      if (!existing.pages[existing.currentPage]) {
        fetchPage(existing.currentPage);
      }
    } else {
      setCurrentPage(1);
      fetchPage(1);
    }

    return () => {
      cancelledRef.current = true;
    };
  }, [cacheKey, agencyId, fetchPage, setCurrentPage]);

  const goNext = useCallback(async () => {
    const store = useAppStore.getState();
    const entry = store.paginationCache[cacheKey];
    const cur = currentPage;
    const prevPage = entry?.pages[cur];
    if (prevPage && prevPage.items.length < pageSize) return;

    const next = cur + 1;
    if (entry?.pages[next]) {
      setCurrentPage(next);
    } else {
      await fetchPage(next);
      const updated = useAppStore.getState().paginationCache[cacheKey];
      if (updated?.pages[next] && !cancelledRef.current) {
        setCurrentPage(next);
      }
    }
  }, [cacheKey, fetchPage, pageSize, currentPage]);

  const goPrev = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage((p) => p - 1);
    }
  }, [currentPage]);

  const goToPage = useCallback(
    async (page: number) => {
      const store = useAppStore.getState();
      const entry = store.paginationCache[cacheKey];
      const total = entry?.totalCount ?? 0;
      const clamped = Math.max(
        1,
        Math.min(page, Math.max(1, Math.ceil(total / pageSize))),
      );

      if (entry?.pages[clamped]) {
        setCurrentPage(clamped);
        return;
      }

      const pageNums = Object.keys(entry?.pages ?? {})
        .map(Number)
        .sort((a, b) => a - b);
      const lastCached = pageNums.length > 0 ? Math.max(...pageNums) : 0;

      if (clamped <= lastCached) {
        setCurrentPage(clamped);
        return;
      }

      for (let p = lastCached + 1; p <= clamped; p++) {
        const stored = useAppStore.getState().paginationCache[cacheKey];
        if (stored?.pages[p]) continue;
        if (cancelledRef.current) return;
        await fetchPage(p);
      }

      if (!cancelledRef.current) {
        setCurrentPage(clamped);
      }
    },
    [cacheKey, fetchPage, pageSize],
  );

  const handleSetPageSize = useCallback(
    (size: number) => {
      clearPaginationCache(cacheKey);
      setPageSize(size);
      setCurrentPage(1);
    },
    [cacheKey, clearPaginationCache, setCurrentPage],
  );

  const refresh = useCallback(() => {
    clearPaginationCache(cacheKey);
    setCurrentPage(1);
    fetchPage(1);
  }, [cacheKey, clearPaginationCache, fetchPage, setCurrentPage]);

  return {
    items,
    totalCount: displayTotalCount,
    totalPages,
    currentPage,
    pageSize,
    loading,
    goNext,
    goPrev,
    goToPage,
    setPageSize: handleSetPageSize,
    refresh,
  };
};
