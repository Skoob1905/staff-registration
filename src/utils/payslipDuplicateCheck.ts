export interface DuplicateCheckItem {
  workerRef: string;
  displayName: string;
}

export interface DuplicateCheckResult extends DuplicateCheckItem {
  isDuplicate: boolean;
}

/**
 * Checks a list of payslip files against existing payslips for each staff
 * member to detect duplicate filenames.
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

  const results: DuplicateCheckResult[] = await Promise.all(
    items.map(async (item) => {
      const existing = await getNames(item.workerRef);
      return {
        ...item,
        isDuplicate: existing.includes(item.displayName),
      };
    }),
  );

  return results;
}
