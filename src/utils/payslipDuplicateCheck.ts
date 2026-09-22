export interface DuplicateCheckItem {
  workerRef: string;
  displayName: string;
}

export interface DuplicateCheckResult extends DuplicateCheckItem {
  isDuplicate: boolean;
}

/**
 * Normalizes a payslip display name for comparison. Storage de-duplication can
 * append a `_<n>` suffix to a stored filename, so that suffix is stripped before
 * comparing. Matching is case-insensitive and whitespace-trimmed.
 */
export function normalizePayslipName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/(_\d+)(\.[^.]+)$/, "$2");
}

/**
 * Checks a list of payslip files against existing payslips for each staff
 * member to detect duplicate filenames. Also treats a repeated
 * `workerRef` + `displayName` within the same list as a duplicate.
 *
 * Deduplicates Firestore calls per workerRef — if five files share the same
 * workerRef, only one fetch is made. Matches against `displayName`
 * (the shortened name that will be stored, e.g. "Payslip for Week 10.pdf").
 *
 * @param items    - Items to check, each with `workerRef` and `displayName`.
 * @param fetchExistingNames - Async function returning stored filenames for a
 *                             given workerRef (injected for testability).
 * @returns The input items with an `isDuplicate` boolean appended.
 */
export async function checkDuplicatePayslip(
  items: DuplicateCheckItem[],
  fetchExistingNames: (workerRef: string) => Promise<string[]>,
): Promise<DuplicateCheckResult[]> {
  const cache = new Map<string, string[]>();
  const pending = new Map<string, Promise<string[]>>();

  const getNames = async (workerRef: string): Promise<string[]> => {
    if (cache.has(workerRef)) return cache.get(workerRef)!;
    if (pending.has(workerRef)) return pending.get(workerRef)!;
    const promise = fetchExistingNames(workerRef).then((names) => {
      cache.set(workerRef, names);
      pending.delete(workerRef);
      return names;
    });
    pending.set(workerRef, promise);
    return promise;
  };

  const seen = new Set<string>();
  const duplicatedWithinBatch = items.map((item) => {
    const key = `${item.workerRef}|${normalizePayslipName(item.displayName)}`;
    if (seen.has(key)) return true;
    seen.add(key);
    return false;
  });

  const results: DuplicateCheckResult[] = await Promise.all(
    items.map(async (item, index) => {
      const existing = await getNames(item.workerRef);
      const normalized = normalizePayslipName(item.displayName);
      const existsRemotely = existing.some(
        (name) => normalizePayslipName(name) === normalized,
      );
      return {
        ...item,
        isDuplicate: duplicatedWithinBatch[index] || existsRemotely,
      };
    }),
  );

  return results;
}
