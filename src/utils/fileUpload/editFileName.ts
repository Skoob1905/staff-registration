const WEEK_PATTERN = /week\s+(\d+)/i;

/**
 * Extracts a "Payslip for Week XX.pdf" label from a payslip filename.
 *
 * Looks for a case-insensitive "Week XX" pattern in the filename and,
 * if found, returns `"Payslip for Week {number}.pdf"`. If no such
 * pattern is present the original filename is returned unchanged.
 *
 * @param fileName - The full payslip filename (e.g. `"PAYE John Smith Week 10 (ABC123).pdf"`)
 * @returns The display name (e.g. `"Payslip for Week 10.pdf"`) or the original filename.
 */
export function editFileName(fileName: string): string {
  const match = fileName.match(WEEK_PATTERN);
  if (!match) return fileName;
  return `Payslip for Week ${match[1]}.pdf`;
}
