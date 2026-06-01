# Hook Architecture — Algolia-backed pagination

## Data flow

```
Firestore ──(onDocumentWritten trigger)──→ Algolia ──(search)──→ UI (usePaginatedRecords)
```

All three indices are kept in sync via Firestore cloud functions (`functions/src/index.ts:1709`). When a document is written in Firestore, the trigger pushes the change to Algolia. The UI never talks to Firestore for reads — it always goes through Algolia.

## The three indices

| Algolia index | Firestore source | Trigger function | Each record represents | Key facet |
|---|---|---|---|---|
| `staff` | `staff/{docId}` | `syncStaffToAlgolia` | One staff member (NI number, name, address, metadata) | `metadata.uploadedBy` (agency that uploaded) or `metadata.assignedToId` (agency assigned to) |
| `clients` | `agencies/{docId}` | `syncAgencyToAlgolia` | One agency/client (business name, contact info) | `metadata.uploadedBy` (agency that added them) |
| `logins` | `users/{docId}` (role=client) | `syncClientUserToAlgolia` | One client login (email, assignedTo, invitedByAgencyId) | `invitedByAgencyId` (agency that invited them) |

## `usePaginatedRecords` (`usePaginatedRecords.ts`)

Generic hook used by all list pages.

```
usePaginatedRecords<T>({
  indexName,      // "staff" | "clients" | "logins"
  agencyId,       // scopes results to the current agency
  facetFilters,   // string[][] — see "Facet filter pattern" below
  query,          // free-text search (usually filters.name)
  page,           // 0-indexed
  hitsPerPage,    // default 50
})
```

Returns `{ items, loading, totalPages, totalResults, refresh }`.

### Cache clearing

Algolia's JS client caches search responses **in memory** by default (browser `responsesCache`). This means a second search with identical params returns stale data. `refresh()` calls `client.clearCache()` before incrementing the refresh key to force a fresh network request.

### Facet filter pattern

Each page builds its own `facetFilters` array via `useMemo`:

- **StaffPage** — filters by `metadata.uploadedBy:{agencyId}`, plus optional `tags:{tagId}` and `metadata.assignedToId:{agencyId}`
- **ClientsPage** — filters by `metadata.uploadedBy:{agencyId}`
- **AdminPage (logins)** — filters by `invitedByAgencyId:{agencyId}`, plus optional `assignedTo:{agencyId}`
- **AssignedStaffSection** — filters by `metadata.assignedToId:{targetAgencyId}`, plus optional `tags:{tagId}`

### Mutation → refresh delay

After a Firestore mutation (CSV upload, delete, assign), a 2-second delay (`setTimeout(refresh, 2000)`) gives the Algolia trigger time to propagate before the cache-clearing re-fetch.

### StaffFilters (`types/domain.ts:82`)

```
{ name: string, typeIds: string[], agencyIds: string[], tagIds: string[] }
```

`useFilterParams` serialises this to/from URL search params so filters survive navigation.

## Adding a new index

1. Create a Firestore `onDocumentWritten` trigger in `functions/src/index.ts` that pushes to Algolia
2. Define the Algolia index in the Algolia dashboard (set searchable attributes, facet attributes)
3. Use `usePaginatedRecords` in the UI — pass `indexName`, `agencyId`, and build `facetFilters`
