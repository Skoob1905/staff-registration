import { getStaff } from "../../services/firestore";

export interface MatchResult {
  status: "missing" | "wrong info" | "matched";
  workerRef?: string;
  email?: string;
  agencyId?: string;
}

/**
 * Matches a parsed file against an existing staff record in Firestore.
 * Looks up the staff document by its worker reference (the document ID) and
 * performs a case-insensitive comparison of the forename and surname.
 *
 * @param firstname - The first name extracted from the filename.
 * @param lastname  - The last name extracted from the filename.
 * @param workerRef - The worker reference (staff Firestore document ID) extracted
 *                    from the filename.
 * @returns A {@link MatchResult} with the following status values:
 *   - `"missing"`    — No staff document exists with the given worker reference.
 *   - `"wrong info"` — A staff document exists, but the forename or surname
 *                       does not match (case-insensitive). The document's email
 *                       and agencyId are still returned.
 *   - `"matched"`    — A staff document exists and both forename and surname
 *                       match (case-insensitive). The document's email and
 *                       agencyId are returned.
 */
export async function match(
  firstname: string,
  lastname: string,
  workerRef: string,
): Promise<MatchResult> {
  let staff = await getStaff(workerRef);

  if (!staff && workerRef !== workerRef.toLowerCase()) {
    staff = await getStaff(workerRef.toLowerCase());
  }

  if (!staff && workerRef !== workerRef.toUpperCase()) {
    staff = await getStaff(workerRef.toUpperCase());
  }

  if (!staff) {
    return { status: "missing" };
  }

  const data = staff as Record<string, unknown>;
  const matchedWorkerRef = typeof data.id === "string" ? data.id : workerRef;
  const email = typeof data.email === "string" ? data.email : undefined;
  const agencyId =
    typeof data.agencyId === "string" ? data.agencyId : undefined;
  const docForename = typeof data.Forename === "string" ? data.Forename : "";
  const docSurname = typeof data.Surname === "string" ? data.Surname : "";

  const nameMatch =
    docForename.toLowerCase() === firstname.toLowerCase() &&
    docSurname.toLowerCase() === lastname.toLowerCase();

  if (!nameMatch) {
    return { status: "wrong info", workerRef: matchedWorkerRef, email, agencyId };
  }

  return { status: "matched", workerRef: matchedWorkerRef, email, agencyId };
}
