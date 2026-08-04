import { getStaff } from "../../services/firestore";
import type { StaffCsvRow } from "../../types/domain";

export type StaffMatchStatus = StaffCsvRow["status"];

export async function matchStaffRow(
  ref: string,
  forename: string,
  surname: string,
): Promise<{
  status: StaffMatchStatus;
  existingName?: string;
  existingEmail?: string;
}> {
  let staff = await getStaff(ref);

  if (!staff && ref !== ref.toLowerCase()) {
    staff = await getStaff(ref.toLowerCase());
  }

  if (!staff && ref !== ref.toUpperCase()) {
    staff = await getStaff(ref.toUpperCase());
  }

  if (!staff) return { status: "New" };

  const data = staff as Record<string, unknown>;
  const docForename =
    typeof data.Forename === "string" ? data.Forename : "";
  const docSurname =
    typeof data.Surname === "string" ? data.Surname : "";
  const docEmail =
    typeof data.email === "string" ? data.email : "";

  const nameMatch =
    docForename.toLowerCase() === forename.toLowerCase() &&
    docSurname.toLowerCase() === surname.toLowerCase();

  if (nameMatch) {
    return {
      status: "duplicate",
      existingName: `${docForename} ${docSurname}`.trim() || undefined,
      existingEmail: docEmail || undefined,
    };
  }

  return {
    status: "different info",
    existingName: `${docForename} ${docSurname}`.trim() || undefined,
    existingEmail: docEmail || undefined,
  };
}
