import type { BulkStaff } from "../types/domain";

export function normalizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

const NI_NORMALIZED_VARIANTS = new Set([
  "ninumber",
  "nino",
  "nationalinsurancenumber",
  "nationalinsuranceno",
  "nationalinsurance",
  "nin",
  "ni",
  "natinsnumber",
  "natinsno",
  "natins",
  "nationalins",
  "ninsurance",
  "insurance",
  "ssn",
  "socialsecuritynumber",
  "nidentifier",
  "nationalid",
  "natid",
  "niid",
]);

const BUSINESS_NAME_NORMALIZED_VARIANTS = new Set([
  "businessname",
  "business",
  "companyname",
  "company",
  "organisationname",
  "organisation",
  "organizationname",
  "organization",
  "agencyname",
  "agency",
  "clientname",
  "client",
  "firmname",
  "firm",
  "employername",
  "employer",
  "entityname",
  "entity",
]);

const WORKER_REF_NORMALIZED_VARIANTS = new Set([
  "ref",
  "reference",
  "workersref",
  "workerref",
  "worksno",
  "worksnumber",
]);

export function hasWorkerRefColumn(headers: string[]): boolean {
  return headers.some((h) =>
    WORKER_REF_NORMALIZED_VARIANTS.has(normalizeKey(h)),
  );
}

export function hasNIColumn(headers: string[]): boolean {
  return headers.some((h) => NI_NORMALIZED_VARIANTS.has(normalizeKey(h)));
}
export function getNINumber(row: Record<string, string>): string {
  for (const [key, value] of Object.entries(row)) {
    if (NI_NORMALIZED_VARIANTS.has(normalizeKey(key))) {
      return value;
    }
  }
  return "";
}

export function hasBusinessNameColumn(headers: string[]): boolean {
  return headers.some((h) =>
    BUSINESS_NAME_NORMALIZED_VARIANTS.has(normalizeKey(h)),
  );
}

export function getBusinessName(row: Record<string, string>): string {
  for (const [key, value] of Object.entries(row)) {
    if (BUSINESS_NAME_NORMALIZED_VARIANTS.has(normalizeKey(key))) {
      return value;
    }
  }
  return "";
}

export function findValueByNormalizedKey(
  data: Record<string, unknown>,
  ...targets: string[]
): string | null {
  for (const [key, value] of Object.entries(data)) {
    const nk = normalizeKey(key);
    if (targets.some((t) => normalizeKey(t) === nk)) {
      return String(value ?? "");
    }
  }
  return null;
}

export function getStaffName(staff: BulkStaff): string {
  const raw = staff as unknown as Record<string, unknown>;

  const forename = findValueByNormalizedKey(raw, "forename", "firstname");
  const surname = findValueByNormalizedKey(raw, "surname", "lastname");
  const title = findValueByNormalizedKey(raw, "title");

  if (forename || surname) {
    return [title, forename, surname].filter(Boolean).join(" ");
  }

  const fullname = findValueByNormalizedKey(raw, "fullname");
  if (fullname) return fullname;

  return staff.email || "";
}

export function getStaffNameFromRawRecord(
  record: Record<string, string>,
): string {
  const keys = Object.keys(record);

  const findKey = (...names: string[]) => {
    for (const name of names) {
      const match = keys.find((k) => normalizeKey(k) === normalizeKey(name));
      if (match) return record[match];
    }
    return "";
  };

  const title = findKey("title");
  const forename = findKey("forename", "firstname");
  const surname = findKey("surname", "lastname");
  const fullName = findKey("fullname");

  const hasName = forename || surname;
  if (hasName) {
    return [title, forename, surname].filter(Boolean).join(" ");
  }

  if (fullName) {
    return [title, fullName].filter(Boolean).join(" ");
  }

  return findKey("email") || "Unknown";
}
