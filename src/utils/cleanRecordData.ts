const DEFAULT_SKIP = new Set([
  "id",
  "objectID",
  "metadata",
  "agencyId",
  "importedByAgencyId",
  "importedByUid",
  "importedAt",
  "uploadedInFile",
  "business_name",
  "sortableName",
  "uid",
  "tags",
  "typeIds",
]);

/**
 * Filters a record to a sorted key-value map, skipping internal fields
 * and keeping only string, number, or boolean values.
 *
 * @param record - The raw data record to clean
 * @param extraSkip - Optional additional field names to skip
 * @returns A sorted Record of label → value pairs
 */
export const cleanRecordData = (
  record: Record<string, unknown>,
  extraSkip?: string[],
): Record<string, string> => {
  const skip = new Set(DEFAULT_SKIP);
  if (extraSkip) for (const key of extraSkip) skip.add(key);

  const result: Record<string, string> = {};
  const keys: string[] = [];

  for (const [key, value] of Object.entries(record)) {
    if (skip.has(key)) continue;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      result[key] = String(value);
      keys.push(key);
    }
  }

  keys.sort((a, b) => a.localeCompare(b));

  const sorted: Record<string, string> = {};
  for (const key of keys) {
    sorted[key] = result[key];
  }

  return sorted;
};
