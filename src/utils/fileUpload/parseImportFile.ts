import * as XLSX from "xlsx";

export interface ParsedImportFile {
  headers: string[];
  rows: Record<string, string>[];
}

function parseCsvMatrix(text: string): string[][] {
  const lines = text.trim().split("\n");
  if (lines.length === 0) return [];

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  return lines.map(parseLine);
}

function parseXlsxMatrix(buffer: ArrayBuffer): string[][] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils
    .sheet_to_json<Array<string | number | boolean | null | undefined>>(sheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    })
    .map((row) =>
      row.map((cell) =>
        cell === null || cell === undefined ? "" : String(cell).trim(),
      ),
    );
}

function matrixToRecords(matrix: string[][]): ParsedImportFile {
  if (matrix.length < 2) return { headers: [], rows: [] };

  const seen = new Set<string>();
  const headers: string[] = [];
  const headerIndices: number[] = [];
  matrix[0].forEach((header, idx) => {
    if (!seen.has(header)) {
      seen.add(header);
      headers.push(header);
      headerIndices.push(idx);
    }
  });

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < matrix.length; i++) {
    const values = matrix[i];
    if (values.length === 1 && values[0] === "") continue;
    const row: Record<string, string> = {};
    headerIndices.forEach((rawIdx, mappedIdx) => {
      row[headers[mappedIdx]] = values[rawIdx] ?? "";
    });
    rows.push(row);
  }

  return { headers, rows };
}

export async function parseImportFile(file: File): Promise<ParsedImportFile> {
  const isXlsx = file.name.toLowerCase().endsWith(".xlsx");
  const matrix = isXlsx
    ? parseXlsxMatrix(await file.arrayBuffer())
    : parseCsvMatrix(await file.text());
  return matrixToRecords(matrix);
}
