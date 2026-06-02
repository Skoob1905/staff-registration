import { useEffect, useReducer, useCallback, useState } from "react";
import { searchClient } from "@algolia/client-search";

const ALGOLIA_INDEX_PREFIX = import.meta.env.VITE_ALGOLIA_INDEX_PREFIX ?? "";

const algoliaClient = searchClient(
  import.meta.env.VITE_ALGOLIA_APP_ID,
  import.meta.env.VITE_ALGOLIA_SEARCH_ONLY_API_KEY,
);

interface State<T> {
  items: T[];
  loading: boolean;
  totalPages: number;
  totalResults: number;
}

type Action<T> =
  | { type: "loading" }
  | { type: "success"; items: T[]; totalPages: number; totalResults: number }
  | { type: "error" };

function createInitialState<T>(): State<T> {
  return { items: [], loading: true, totalPages: 0, totalResults: 0 };
}

interface UsePaginatedRecordsParams {
  indexName: string;
  agencyId: string;
  facetFilters?: string[][];
  query?: string;
  page?: number;
  hitsPerPage?: number;
}

export function usePaginatedRecords<T = Record<string, unknown>>({
  indexName,
  agencyId,
  facetFilters,
  query = "",
  page = 0,
  hitsPerPage = 50,
}: UsePaginatedRecordsParams) {
  const [state, dispatch] = useReducer(
    (prev: State<T>, action: Action<T>): State<T> => {
      switch (action.type) {
        case "loading":
          return { ...prev, loading: true };
        case "success":
          return {
            items: action.items,
            loading: false,
            totalPages: action.totalPages,
            totalResults: action.totalResults,
          };
        case "error":
          return { ...prev, loading: false };
      }
    },
    createInitialState<T>(),
  );
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!agencyId) return;

    let cancelled = false;
    dispatch({ type: "loading" });

    algoliaClient
      .searchSingleIndex<T>({
        indexName: `${ALGOLIA_INDEX_PREFIX}${indexName}`,
        searchParams: {
          query,
          page,
          hitsPerPage,
          facetFilters: facetFilters ?? [],
        },
      })
      .then((response) => {
        if (cancelled) return;
        const formattedHits = response.hits.map((hit) => {
          const {
            objectID,
            _highlightResult,
            _snippetResult,
            _rankingInfo,
            sortableName,
            sortableEmail,
            ...rest
          } = hit;
          return { id: objectID, ...rest } as unknown as T;
        });

        dispatch({
          type: "success",
          items: formattedHits,
          totalPages: response.nbPages ?? 0,
          totalResults: response.nbHits ?? 0,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(
          `[usePaginatedRecords] Algolia search failed for ${indexName}:`,
          err,
        );
        dispatch({ type: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [agencyId, indexName, page, hitsPerPage, refreshKey, query, facetFilters]);

  const refresh = useCallback(() => {
    algoliaClient.clearCache().then(() => setRefreshKey((k) => k + 1));
  }, []);

  return {
    items: state.items,
    loading: state.loading,
    totalPages: state.totalPages,
    totalResults: state.totalResults,
    refresh,
  };
}
