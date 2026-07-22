# Algolia Admin Commands

These commands use the `@algolia/client-search` Node.js package and the **admin API key** (from `functions/.env.<env>` — `ALGOLIA_ADMIN_API_KEY`).

---

## 1. Check index settings

Read `attributesForFaceting`, `replicas`, and `primaryReplica` for any index.

```javascript
node -e "
const { searchClient } = require('@algolia/client-search');
const client = searchClient('AA300I6949', '<ADMIN_API_KEY>');

(async () => {
  const settings = await client.getSettings({ indexName: 'staff' });
  console.log('attributesForFaceting:', settings.attributesForFaceting);
  console.log('replicas:', settings.replicas);
})();
"
```

Change `'staff'` to `'staff_name_desc'` to inspect the replica.

---

## 2. Compare dev and prod settings inline

```javascript
node -e "
const { searchClient } = require('@algolia/client-search');

(async () => {
  const dev = searchClient('SN7KV5MQMS', '<DEV_ADMIN_API_KEY>');
  const prod = searchClient('AA300I6949', '<PROD_ADMIN_API_KEY>');

  for (const [label, client] of [['DEV', dev], ['PROD', prod]]) {
    const primary = await client.getSettings({ indexName: 'staff' });
    const replica = await client.getSettings({ indexName: 'staff_name_desc' });
    console.log('=== ' + label + ' staff ===');
    console.log(primary.attributesForFaceting);
    console.log('=== ' + label + ' staff_name_desc ===');
    console.log(replica.attributesForFaceting);
    console.log();
  }
})();
"
```

---

## 3. Copy facet config from primary to replica

When a virtual replica has `attributesForFaceting: null` (not inheriting from primary), set it on the **primary with `forwardToReplicas: true`**:

```javascript
node -e "
const { searchClient } = require('@algolia/client-search');
const client = searchClient('AA300I6949', '<ADMIN_API_KEY>');

(async () => {
  await client.setSettings({
    indexName: 'staff',
    indexSettings: {
      attributesForFaceting: [
        'filterOnly(metadata.assignedToId)',
        'filterOnly(metadata.assignedToName)',
        'filterOnly(metadata.payslipCount)',
        'filterOnly(metadata.tags)',
        'filterOnly(sortableName)'
      ],
    },
    forwardToReplicas: true,
  });
  console.log('Done');

  const result = await client.getSettings({ indexName: 'staff_name_desc' });
  console.log('staff_name_desc attributesForFaceting:', result.attributesForFaceting);
})();
"
```

> **Note:** Setting on the replica directly (`client.setSettings({ indexName: 'staff_name_desc', ... })`) silently succeeds but doesn't persist for virtual replicas. Always use `forwardToReplicas: true` on the primary.

---

## 4. Test facetFilters on an index

Verify that `metadata.assignedToId` filtering returns hits. Use a real agency ID from the data (Firestore doc IDs, not numeric `#10086`).

```javascript
node -e "
const { searchClient } = require('@algolia/client-search');
const client = searchClient('AA300I6949', '<ADMIN_API_KEY>');

(async () => {
  const res = await client.searchSingleIndex({
    indexName: 'staff_name_desc',
    searchParams: {
      query: '',
      facetFilters: [['metadata.assignedToId:KM2JH2toAatQ7QFTqBOx']],
      hitsPerPage: 5,
      attributesToRetrieve: ['fullName', 'metadata.assignedToId'],
    },
  });
  console.log('nbHits:', res.nbHits);
  res.hits.forEach(h => console.log(' -', h.fullName || '(no name)', '| assignedToId:', h.metadata?.assignedToId));
})();
"
```

Replace `KM2JH2toAatQ7QFTqBOx` with a real ID from an unfiltered search:

```javascript
node -e "
const { searchClient } = require('@algolia/client-search');
const client = searchClient('AA300I6949', '<ADMIN_API_KEY>');

(async () => {
  const res = await client.searchSingleIndex({
    indexName: 'staff',
    searchParams: { query: '', hitsPerPage: 3, attributesToRetrieve: ['fullName', 'metadata.assignedToId'] },
  });
  console.log('Total hits:', res.nbHits);
  res.hits.forEach(h => console.log(h.metadata?.assignedToId, '-', h.fullName));
})();
"
```

---

## Environment Reference

| Environment | App ID | Admin API Key source |
|---|---|---|
| Dev | `SN7KV5MQMS` | `functions/.env.mdsce-dev` → `ALGOLIA_ADMIN_API_KEY` |
| Prod | `AA300I6949` | `functions/.env.mdsce-prod` → `ALGOLIA_ADMIN_API_KEY` |
