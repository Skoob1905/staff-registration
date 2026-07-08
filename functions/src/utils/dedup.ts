import type { Firestore } from "firebase-admin/firestore";

interface DedupConfig {
  db: Firestore;
  collectionName: string;
  records: Array<Record<string, unknown>>;
  getKey: (record: Record<string, unknown>) => string;
  oldQueryField?: string;
  newQueryField?: string;
  agencyId?: string;
  fetchAll?: boolean;
}

interface DedupResult {
  newRecords: Array<Record<string, unknown>>;
  duplicateCount: number;
  existingKeys: Set<string>;
}

export async function dedupRecords(config: DedupConfig): Promise<DedupResult> {
  const {
    db,
    collectionName,
    oldQueryField,
    newQueryField,
    records,
    getKey,
    agencyId,
    fetchAll,
  } = config;

  const existingKeys = new Set<string>();

  if (fetchAll) {
    const snap = await db.collection(collectionName).get();
    for (const doc of snap.docs) {
      const data = doc.data();
      const key = getKey(data).toLowerCase().trim();
      if (key) existingKeys.add(key);
    }
  } else if (agencyId) {
    const ref = db.collection(collectionName);
    const [oldSnaps, newSnaps] = await Promise.all([
      ref.where(oldQueryField!, "==", agencyId).get(),
      ref.where(newQueryField!, "==", agencyId).get(),
    ]);

    const docSeen = new Set<string>();
    for (const doc of [...oldSnaps.docs, ...newSnaps.docs]) {
      if (docSeen.has(doc.id)) continue;
      docSeen.add(doc.id);
      const data = doc.data();
      const key = getKey(data).toLowerCase().trim();
      if (key) existingKeys.add(key);
    }
  }

  let duplicateCount = 0;
  const newRecords: Array<Record<string, unknown>> = [];

  for (const record of records) {
    if (typeof record !== "object" || record === null) continue;
    const key = getKey(record).toLowerCase().trim();
    if (key && existingKeys.has(key)) {
      duplicateCount++;
      continue;
    }
    if (key) existingKeys.add(key);
    newRecords.push(record);
  }

  return { newRecords, duplicateCount, existingKeys };
}
