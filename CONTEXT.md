# Context

## Glossary

### Duplicate Detection
The process of identifying records during CSV import that already exist in Firestore. Performed exclusively server-side in the cloud function — the client does not filter duplicates before sending records.

### NI Number Variants
The set of 24 normalized column-name variants used to identify NI Number columns in CSV headers (e.g. `ninumber`, `nino`, `nationalinsurancenumber`, `ni`, `insurance`, `ssn`). Defined identically in both `src/utils/keyHeaderNormalisation.ts` and `functions/src/index.ts`.

### Business Name Variants
The set of 4 normalized column-name variants used to identify business/company name columns (e.g. `businessname`, `business`, `companyname`, `company`). Defined identically in both client and server.

### metadata.uploadedBy
The canonical field on staff and agency documents identifying which agency imported the record. Used as the primary filter for dedup queries, alongside legacy `agencyId` / `importedByAgencyId` for backward compatibility.

### Algolia Internal Fields
The fields `objectID`, `_highlightResult`, `_snippetResult`, and `_rankingInfo` are stripped from every hit in `usePaginatedRecords` before data reaches the UI.

### csv_imports
A Firestore collection tracking each import operation. Contains `agencyId`, `type` (staff/agency), `fileName`, `recordCount`, `totalRecords`, and timestamps.

### FilterKeyMap
A configuration object passed to `PaginatedFilterSection` that maps each filter dimension (tag, agency) to the corresponding Algolia field name for that index. Decouples the generic filter UI from index-specific schemas.

```
staff  index: { tag: "tags",              agency: "metadata.assignedToId" }
logins index: { tag: "tags",              agency: "assignedTo" }
```

### Filter field names by index

| Index | Tag field | Agency/client field |
|---|---|---|
| `staff_name_desc` | `tags` | `metadata.assignedToId` |
| `logins_email_desc` | `tags` | `assignedTo` |
| `clients_name_desc` | — | `metadata.uploadedBy` |

### buildFacetFilters
Pure utility (`src/utils/loginsFilter.ts`) that takes `StaffFilters` + `FilterKeyMap` and returns the `string[][]` facet filter array for Algolia. Each filter dimension becomes a separate OR-group (inner array), and dimensions are AND'd together (outer array).

### buildFacetRequestFields
Pure utility (`src/utils/loginsFilter.ts`) that takes a `FilterKeyMap` and returns the list of facet attribute names to request counts from Algolia via the `facets` search parameter.
