const normalizeKey = (key: string): string =>
  key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

const VARIANTS = new Set([
  "clientref",
  "clientreference",
  "clientrefnumber",
  "refnumber",
  "referencenumber",
  "reference",
  "ref",
  "customernumber",
  "customerno",
  "customernum",
  "customref",
  "customerref",
]);

export const getClientRef = (record: Record<string, unknown>): string => {
  for (const [key, value] of Object.entries(record)) {
    if (VARIANTS.has(normalizeKey(key))) return String(value ?? "");
  }
  return "";
};
