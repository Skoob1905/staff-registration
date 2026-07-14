export interface ParsedPayslipName {
  firstname: string;
  lastname: string;
  workerRef: string;
}

/**
 * Parses a filename based on the upload type.
 *
 * - `"payslip"` — expects `[prefix...] [firstname] [lastname] ([workerRef]).pdf`.
 *   The prefix is optional; the name is the last two words before the
 *   parenthesised worker reference.
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

    const parenMatch = withoutExt.match(/\(([^)]*)\)\s*$/);
    if (!parenMatch) return null;

    const workerRef = parenMatch[1].trim();
    if (!workerRef) return null;

    const beforeParen = withoutExt.slice(0, parenMatch.index).trim();
    const words = beforeParen.split(/\s+/);
    if (words.length < 2) return null;

    const lastname = words[words.length - 1];
    const firstname = words[words.length - 2];
    if (!firstname || !lastname) return null;

    return { firstname, lastname, workerRef };
  }

  return null;
}
