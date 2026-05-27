import type { BulkStaff } from "../types/domain";

export function normalizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
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
  const hasName = staff.Forename || staff.Surname;
  if (hasName) {
    return [staff.Title, staff.Forename, staff.Surname].filter(Boolean).join(" ");
  }

  if (staff.FullName) {
    return [staff.Title, staff.FullName].filter(Boolean).join(" ");
  }

  const raw = staff as Record<string, string>;
  const nk = findValueByNormalizedKey(raw, "fullname");
  if (nk) return nk;

  return staff.email || "";
}

export function getStaffNameFromRawRecord(record: Record<string, string>): string {
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
