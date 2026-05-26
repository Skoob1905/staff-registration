import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
    (s) =>
      (s.Forename?.toLowerCase() ?? "").includes(q) ||
      (s.Surname?.toLowerCase() ?? "").includes(q) ||
      (s.Title?.toLowerCase() ?? "").includes(q) ||
      (s.email?.toLowerCase() ?? "").includes(q),
  );
};

const buildQueryConstraints = (
  agencyId: string,
  assignedToId: string | undefined,
  tagIds: string[],
  agencyIds: string[],
  pageSize: number,
  cursor?: string | null,
) => {
  const c: unknown[] = [collection(db, "staff")];
  console.log("[usePaginatedStaff] buildQueryConstraints input:", { agencyId, assignedToId, tagIds, agencyIds, pageSize, cursor });

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

  c.push(orderBy("Forename"));
  c.push(orderBy(documentId()));

  if (cursor) {
    const [forename, docId] = JSON.parse(cursor) as [string, string];
    c.push(startAfter(forename, docId));
  }

  c.push(limit(pageSize));
  return c;
};

const countQuery = (
  agencyId: string,
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

  if (canFilterTags && !bothActive) {
    c.push(where("tags", "array-contains-any", tagIds));
  }

  if (canFilterAgencies && !bothActive) {
    c.push(where("metadata.assignedToId", "in", agencyIds));
  }

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
      setCurrentPageState((prev) => {
        const next = typeof page === "function" ? page(prev) : page;
        useAppStore.getState().setPaginationMeta(cacheKey, { currentPage: next });
        return next;
      });
    },
    [cacheKey],
  );
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

    if (bothActive && filters.agencyIds.length > 0) {
      const agencySet = new Set(filters.agencyIds);
      result = result.filter(
        (s) =>
          s.metadata?.assignedToId && agencySet.has(s.metadata.assignedToId),
      );
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

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalCount / pageSize)),
    [totalCount, pageSize],
  );

  const fetchPage = useCallback(
    async (pageNum: number) => {
      const store = useAppStore.getState();
      const entry = store.paginationCache[cacheKey];

      if (pageNum === 1) {
        console.log("[usePaginatedStaff] fetchPage called with:", { pageNum, agencyId, assignedToId, tagIds: filters.tagIds, agencyIds: filters.agencyIds, pageSize, cacheKey });
        setPaginationMeta(cacheKey, { loading: true, totalCount: 0 });
        cancelledRef.current = false;

        try {
          const countC = countQuery(
            agencyId,
            assignedToId,
            filters.tagIds,
            filters.agencyIds,
          );
          console.log("[usePaginatedStaff] countQuery constraints length:", countC.length, countC);
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
            agencyId,
            assignedToId,
            filters.tagIds,
            filters.agencyIds,
            pageSize,
          );
          console.log("[usePaginatedStaff] page query constraints length:", pageC.length, pageC);
          const q = query(...(pageC as Parameters<typeof query>));
          console.log("[usePaginatedStaff] executing page 1 query");
          const snap = await getDocs(q);
          console.log("[usePaginatedStaff] page 1 returned docs:", snap.docs.length, snap.docs.map(d => ({ id: d.id, forename: d.data().Forename })));
          if (cancelledRef.current) return;

          const docs = snap.docs.map(
            (d) => ({ id: d.id, ...d.data() }) as BulkStaff,
          );
          const lastCursor =
            docs.length > 0
              ? JSON.stringify([
                  docs[docs.length - 1].Forename ?? "",
                  docs[docs.length - 1].id,
                ])
              : null;

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
          agencyId,
          assignedToId,
          filters.tagIds,
          filters.agencyIds,
          pageSize,
          prevPage.lastCursor,
        );
        const q = query(...(pageC as Parameters<typeof query>));
        const snap = await getDocs(q);
        if (cancelledRef.current) return;

        const docs = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as BulkStaff,
        );
        const lastCursor =
          docs.length > 0
            ? JSON.stringify([
                docs[docs.length - 1].Forename ?? "",
                docs[docs.length - 1].id,
              ])
            : null;

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
    },
    [cacheKey, clearPaginationCache],
  );

  return {
    items,
    totalCount,
    totalPages,
    currentPage,
    pageSize,
    loading,
    goNext,
    goPrev,
    goToPage,
    setPageSize: handleSetPageSize,
  };
};
