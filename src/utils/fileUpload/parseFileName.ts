export interface ParsedPayslipName {
  firstname: string;
  lastname: string;
  workerRef: string;
}

/**
 * Parses a filename based on the upload type.
 *
 * - `"payslip"` — expects `firstname_lastname_workerref.pdf`.
 *   The worker ref can itself contain underscores (e.g. `ref_001`).
 *
 * @param name - The raw filename string (may include leading/trailing whitespace).
 * @param type - The upload type determining the parse format.
 * @returns The parsed name fields or `null` if the filename does not match
 *          the expected format or extension.
 */
export function parseFileName(
  name: string,
  type: "payslip",
): ParsedPayslipName | null;
export function parseFileName(name: string, type: string) {
  if (type === "payslip") {
    const trimmed = name.trim();
    if (!trimmed) return null;

    const withoutExt = trimmed.replace(/\.pdf$/i, "");
    if (!withoutExt || withoutExt === trimmed) return null;

    const parts = withoutExt.split("_");
    if (parts.length < 3) return null;

    const firstname = parts[0].trim();
    const lastname = parts[1].trim();
    const workerRef = parts.slice(2).join("_").trim();

    if (!firstname || !lastname || !workerRef) return null;

    return { firstname, lastname, workerRef };
  }

  return null;
}
