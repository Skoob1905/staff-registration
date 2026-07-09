const normalizeKey = (key: string): string =>
  key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

export const STAFF_REF_NORMALIZED_VARIANTS = new Set([
  "ref",
  "reference",
  "workersref",
  "workerref",
]);

export const AGENCY_REF_NORMALIZED_VARIANTS = new Set([
  "ref",
  "reference",
  "agencyref",
]);

export const CLIENT_REF_NORMALIZED_VARIANTS = new Set([
  "ref",
  "reference",
  "clientref",
]);

export const getRef = (
  record: Record<string, unknown>,
  variants: Set<string>,
): string => {
  for (const [key, value] of Object.entries(record)) {
    if (variants.has(normalizeKey(key))) return String(value ?? "");
  }
  return "";
};

export const getStaffRef = (record: Record<string, unknown>): string =>
  getRef(record, STAFF_REF_NORMALIZED_VARIANTS);

export const getAgencyRef = (record: Record<string, unknown>): string =>
  getRef(record, AGENCY_REF_NORMALIZED_VARIANTS);

export const getClientRef = (record: Record<string, unknown>): string =>
  getRef(record, CLIENT_REF_NORMALIZED_VARIANTS);
