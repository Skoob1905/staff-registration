const STAFF_REF_NORMALIZED_VARIANTS = new Set([
  "ref",
  "reference",
  "workersref",
]);

const normalizeKey = (key: string): string =>
  key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

export const getStaffRef = (
  record: Record<string, unknown>,
): string => {
  for (const [key, value] of Object.entries(record)) {
    if (STAFF_REF_NORMALIZED_VARIANTS.has(normalizeKey(key)))
      return String(value ?? "");
  }
  return "";
};
