import * as XLSX from "xlsx";
import { normalizeKey } from "./keyHeaderNormalisation";

export type CleanedCSV = {
  headers: string[];
  rows: Record<string, string>[];
  found: FoundTargets;
  hasHeaders: boolean;
};

export type CleanedFile = {
  headers: string[];
  rows: Record<string, string>[];
  fileName: string;
  rawFile: File;
  found: FoundTargets;
  hasHeaders: boolean;
};

export interface FoundTargets {
  ref: boolean;
  forename: boolean;
  surname: boolean;
  email: boolean;
}

const REF_SET = new Set([
  // spec variants
  "payrollno",
  "payrollnumber",
  "workerno",
  "workernumber",
  "worksnumber",
  "worksno",
  "empno",
  "employeeno",
  "ref",
  "reference",
  "staffid",
  "workerid",
  // existing worker-ref variants
  "workersref",
  "workersreference",
  "workerref",
  "workerreference",
  "worksref",
  "worksreference",
  "clientemployeerefnumber",
]);

const FORENAME_SET = new Set([
  "forename",
  "forename1",
  "firstname",
  "firstname1",
  "givenname",
  "first",
  "first_name",
]);

const SURNAME_SET = new Set([
  "surname",
  "lastname",
  "secondname",
  "familyname",
  "last",
  "last_name",
]);

const EMAIL_SET = new Set([
  "email",
  "emailaddress",
  "mail",
  "mailaddress",
  "useremail",
  "e_mail",
]);

const TARGET_ORDER = ["ref", "forename", "surname", "email"] as const;

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

function matchesAnyTarget(normalized: string): boolean {
  return (
    REF_SET.has(normalized) ||
    FORENAME_SET.has(normalized) ||
    SURNAME_SET.has(normalized) ||
    EMAIL_SET.has(normalized)
  );
}

function detectHeaderIndex(matrix: string[][]): number {
  const searchLimit = Math.min(30, matrix.length);
  if (searchLimit === 0) return -1;

  let headerIdx = 0;
  let maxMatches = -1;
  let foundAny = false;

  for (let i = 0; i < searchLimit; i++) {
    const row = matrix[i];
    if (!row) continue;
    let matches = 0;
    for (const cell of row) {
      if (matchesAnyTarget(normalizeKey(cell))) {
        matches++;
        foundAny = true;
      }
    }
    if (matches > maxMatches) {
      maxMatches = matches;
      headerIdx = i;
    }
  }

  return foundAny ? headerIdx : -1;
}

function mapColumns(headers: string[]): {
  found: FoundTargets;
  targetMap: Record<string, "ref" | "forename" | "surname" | "email">;
  unmappedIndices: number[];
} {
  const found: FoundTargets = {
    ref: false,
    forename: false,
    surname: false,
    email: false,
  };
  const targetMap: Record<string, "ref" | "forename" | "surname" | "email"> =
    {};
  const unmappedIndices: number[] = [];

  headers.forEach((header, idx) => {
    const norm = normalizeKey(header);

    if (!found.ref && REF_SET.has(norm)) {
      targetMap[idx] = "ref";
      found.ref = true;
    } else if (!found.forename && FORENAME_SET.has(norm)) {
      targetMap[idx] = "forename";
      found.forename = true;
    } else if (!found.surname && SURNAME_SET.has(norm)) {
      targetMap[idx] = "surname";
      found.surname = true;
    } else if (!found.email && EMAIL_SET.has(norm)) {
      targetMap[idx] = "email";
      found.email = true;
    } else {
      unmappedIndices.push(idx);
    }
  });

  return { found, targetMap, unmappedIndices };
}

export function cleanCSV(text: string): CleanedCSV {
  const matrix = parseCsvMatrix(text);
  return cleanMatrix(matrix);
}

export function cleanXlsx(buffer: ArrayBuffer): CleanedCSV {
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) {
    return { headers: [], rows: [], found: emptyFound(), hasHeaders: false };
  }
  const matrix = XLSX.utils
    .sheet_to_json<Array<string | number | boolean | null | undefined>>(sheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    })
    .map((row) =>
      row.map((cell) =>
        cell === null || cell === undefined ? "" : String(cell)
      )
    );
  return cleanMatrix(matrix);
}

function cleanMatrix(matrix: string[][]): CleanedCSV {
  if (matrix.length === 0) {
    return {
      headers: [],
      rows: [],
      found: emptyFound(),
      hasHeaders: false,
    };
  }

  const headerIdx = detectHeaderIndex(matrix);
  if (headerIdx < 0) {
    return { headers: [], rows: [], found: emptyFound(), hasHeaders: false };
  }
  const rawHeaders = matrix[headerIdx] ?? [];
  const dataRows = matrix.slice(headerIdx + 1);

  const { found, targetMap, unmappedIndices } = mapColumns(rawHeaders);

  const finalHeaders: string[] = [
    ...TARGET_ORDER,
    ...unmappedIndices.map((idx) => rawHeaders[idx] ?? ""),
  ];

  const rows: Record<string, string>[] = [];

  for (const row of dataRows) {
    if (row.length === 1 && row[0] === "") continue;

    const record: Record<string, string> = {};

    for (const target of TARGET_ORDER) {
      const srcIdx = Object.keys(targetMap).find(
        (k) => targetMap[+k] === target
      );
      record[target] = srcIdx !== undefined ? row[+srcIdx] ?? "" : "";
    }

    for (const idx of unmappedIndices) {
      record[rawHeaders[idx] ?? ""] = row[idx] ?? "";
    }

    rows.push(record);
  }

  return { headers: finalHeaders, rows, found, hasHeaders: true };
}

function emptyFound(): FoundTargets {
  return { ref: false, forename: false, surname: false, email: false };
}

export class FileCleaner {
  async cleanFile(file: File): Promise<CleanedFile> {
    const isXlsx = file.name.toLowerCase().endsWith(".xlsx");
    const cleaned = isXlsx
      ? cleanXlsx(await file.arrayBuffer())
      : cleanCSV(await file.text());
    return {
      headers: cleaned.headers,
      rows: cleaned.rows,
      fileName: file.name,
      rawFile: file,
      found: cleaned.found,
      hasHeaders: cleaned.hasHeaders,
    };
  }
}
