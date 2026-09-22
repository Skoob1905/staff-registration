export interface Base64Entry {
  fileBase64: string;
}

/**
 * Splits entries into batches bounded by both a byte budget and a maximum item
 * count. Used to keep bulk payslip callable requests below the function
 * request-size limit, and to keep each request small enough that progress is
 * reported in meaningful steps.
 *
 * Base64 strings are ASCII, so `fileBase64.length` is a good proxy for the
 * number of bytes the entry contributes to the request body.
 *
 * An entry larger than the budget on its own is emitted as its own batch rather
 * than dropped, so the server can report a per-file failure for it.
 *
 * @param entries   - Entries to split, each carrying a `fileBase64` string.
 * @param maxBytes  - Maximum combined base64 length per batch.
 * @param maxItems  - Maximum number of entries per batch.
 * @returns A list of batches, preserving the input order.
 */
export function chunkByBase64Size<T extends Base64Entry>(
  entries: T[],
  maxBytes = 7_000_000,
  maxItems = 50,
): T[][] {
  const batches: T[][] = [];
  let current: T[] = [];
  let currentSize = 0;

  for (const entry of entries) {
    const entrySize = entry.fileBase64.length;
    const exceedsBytes = currentSize + entrySize > maxBytes;
    const exceedsItems = current.length >= maxItems;
    if (current.length > 0 && (exceedsBytes || exceedsItems)) {
      batches.push(current);
      current = [];
      currentSize = 0;
    }
    current.push(entry);
    currentSize += entrySize;
  }

  if (current.length > 0) batches.push(current);
  return batches;
}
