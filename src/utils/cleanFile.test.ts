import { describe, it, expect } from "vitest";
import { FileCleaner, cleanCSV, cleanXlsx } from "./cleanFile";
import * as XLSX from "xlsx";

import standardColumns from "./__data__/standard_columns.csv?raw";
import normalisedColumns from "./__data__/normalised_columns.csv?raw";
import reorderedColumns from "./__data__/reordered_columns.csv?raw";
import bannerBeforeHeaders from "./__data__/banner_before_headers.csv?raw";
import noHeaders from "./__data__/no_headers.csv?raw";
import missingEmail from "./__data__/missing_email.csv?raw";
import missingRef from "./__data__/missing_ref.csv?raw";
import missingForename from "./__data__/missing_forename.csv?raw";
import missingSurname from "./__data__/missing_surname.csv?raw";

function csvToXlsxBuffer(csvText: string): ArrayBuffer {
  const rows = csvText.trim().split("\n").map((line) => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        cells.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    cells.push(current.trim());
    return cells;
  });
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Sheet1");
  const arr = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return arr;
}

describe("cleanCSV", () => {
  describe("standard columns", () => {
    const result = cleanCSV(standardColumns);

    it("detects headers on the first row", () => {
      expect(result.hasHeaders).toBe(true);
      expect(result.headers).toEqual([
        "ref",
        "forename",
        "surname",
        "email",
        "wage",
      ]);
    });

    it("finds all four standard targets", () => {
      expect(result.found).toEqual({
        ref: true,
        forename: true,
        surname: true,
        email: true,
      });
    });

    it("maps each row to the standard columns", () => {
      expect(result.rows).toEqual([
        {
          ref: "101",
          forename: "Alice",
          surname: "Smith",
          email: "alice@example.com",
          wage: "12.50",
        },
        {
          ref: "102",
          forename: "Bob",
          surname: "Jones",
          email: "bob@example.com",
          wage: "14.00",
        },
        {
          ref: "103",
          forename: "Cara",
          surname: "Wilson",
          email: "cara@example.com",
          wage: "11.80",
        },
      ]);
    });
  });

  describe("normalised column variants", () => {
    const result = cleanCSV(normalisedColumns);

    it("resolves variant headers to standard keys", () => {
      expect(result.hasHeaders).toBe(true);
      expect(result.found).toEqual({
        ref: true,
        forename: true,
        surname: true,
        email: true,
      });
      expect(result.headers).toEqual([
        "ref",
        "forename",
        "surname",
        "email",
        "Department",
      ]);
      expect(result.rows[0]).toEqual({
        ref: "201",
        forename: "David",
        surname: "Green",
        email: "david@example.com",
        Department: "Engineering",
      });
    });
  });

  describe("reordered columns", () => {
    const result = cleanCSV(reorderedColumns);

    it("reorders columns to ref, forename, surname, email", () => {
      expect(result.headers).toEqual([
        "ref",
        "forename",
        "surname",
        "email",
        "start_date",
      ]);
      expect(result.rows[0]).toEqual({
        ref: "301",
        forename: "Frank",
        surname: "Reed",
        email: "frank@example.com",
        start_date: "2024-01-15",
      });
      expect(result.rows[1]).toEqual({
        ref: "302",
        forename: "Grace",
        surname: "Moore",
        email: "grace@example.com",
        start_date: "2024-02-01",
      });
    });
  });

  describe("banner before headers", () => {
    const result = cleanCSV(bannerBeforeHeaders);

    it("strips the banner row and finds the real header", () => {
      expect(result.hasHeaders).toBe(true);
      expect(result.headers).toEqual([
        "ref",
        "forename",
        "surname",
        "email",
      ]);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toEqual({
        ref: "401",
        forename: "Henry",
        surname: "Clark",
        email: "henry@example.com",
      });
    });
  });

  describe("missing email column", () => {
    const result = cleanCSV(missingEmail);

    it("inserts empty string for the missing standard field", () => {
      expect(result.hasHeaders).toBe(true);
      expect(result.found.email).toBe(false);
      expect(result.found).toEqual({
        ref: true,
        forename: true,
        surname: true,
        email: false,
      });
      expect(result.headers).toContain("email");
      expect(result.rows[0]).toEqual({
        ref: "601",
        forename: "Omar",
        surname: "Ali",
        email: "",
      });
    });
  });

  describe("missing ref column", () => {
    const result = cleanCSV(missingRef);

    it("flags ref as missing", () => {
      expect(result.hasHeaders).toBe(true);
      expect(result.found.ref).toBe(false);
      expect(result.found).toEqual({
        ref: false,
        forename: true,
        surname: true,
        email: true,
      });
      expect(result.headers).toContain("ref");
      expect(result.rows[0]).toEqual({
        ref: "",
        forename: "Omar",
        surname: "Ali",
        email: "omar@example.com",
      });
    });
  });

  describe("missing forename column", () => {
    const result = cleanCSV(missingForename);

    it("flags forename as missing", () => {
      expect(result.hasHeaders).toBe(true);
      expect(result.found.forename).toBe(false);
      expect(result.found).toEqual({
        ref: true,
        forename: false,
        surname: true,
        email: true,
      });
      expect(result.headers).toContain("forename");
      expect(result.rows[0]).toEqual({
        ref: "601",
        forename: "",
        surname: "Ali",
        email: "omar@example.com",
      });
    });
  });

  describe("missing surname column", () => {
    const result = cleanCSV(missingSurname);

    it("flags surname as missing", () => {
      expect(result.hasHeaders).toBe(true);
      expect(result.found.surname).toBe(false);
      expect(result.found).toEqual({
        ref: true,
        forename: true,
        surname: false,
        email: true,
      });
      expect(result.headers).toContain("surname");
      expect(result.rows[0]).toEqual({
        ref: "601",
        forename: "Omar",
        surname: "",
        email: "omar@example.com",
      });
    });
  });

  describe("no headers", () => {
    const result = cleanCSV(noHeaders);

    it("reports hasHeaders false", () => {
      expect(result.hasHeaders).toBe(false);
      expect(result.headers).toEqual([]);
      expect(result.rows).toEqual([]);
    });
  });
});

describe("cleanXlsx", () => {
  const standardXlsx = csvToXlsxBuffer(standardColumns);
  const noHeadersXlsx = csvToXlsxBuffer(noHeaders);
  const missingEmailXlsx = csvToXlsxBuffer(missingEmail);

  it("detects headers and standard columns from an xlsx", () => {
    const result = cleanXlsx(standardXlsx);
    expect(result.hasHeaders).toBe(true);
    expect(result.headers).toEqual([
      "ref",
      "forename",
      "surname",
      "email",
      "wage",
    ]);
    expect(result.found).toEqual({
      ref: true,
      forename: true,
      surname: true,
      email: true,
    });
    expect(result.rows[0].email).toBe("alice@example.com");
  });

  it("flags hasHeaders false for a no-header xlsx", () => {
    const result = cleanXlsx(noHeadersXlsx);
    expect(result.hasHeaders).toBe(false);
  });

  it("flags email as missing in an xlsx", () => {
    const result = cleanXlsx(missingEmailXlsx);
    expect(result.hasHeaders).toBe(true);
    expect(result.found.email).toBe(false);
    expect(result.rows[0].email).toBe("");
  });
});

describe("FileCleaner", () => {
  it("returns fileName, rawFile and cleaned rows", async () => {
    const file = new File([standardColumns], "staff.csv", {
      type: "text/csv",
    });
    const result = await new FileCleaner().cleanFile(file);

    expect(result.fileName).toBe("staff.csv");
    expect(result.rawFile).toBe(file);
    expect(result.hasHeaders).toBe(true);
    expect(result.rows[0].email).toBe("alice@example.com");
  });

  it("reports hasHeaders false when the file has no usable headers", async () => {
    const file = new File([noHeaders], "staff.csv", { type: "text/csv" });
    const result = await new FileCleaner().cleanFile(file);
    expect(result.hasHeaders).toBe(false);
  });

  it("handles an xlsx file", async () => {
    const buf = csvToXlsxBuffer(standardColumns);
    const file = new File([buf], "staff.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const result = await new FileCleaner().cleanFile(file);
    expect(result.hasHeaders).toBe(true);
    expect(result.rows[0].email).toBe("alice@example.com");
  });
});