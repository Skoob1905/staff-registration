import { describe, it, expect } from "vitest";
import { parseFileName } from "../parseFileName";

describe("parseFileName (payslip)", () => {
  it("parses a valid payslip filename with prefix", () => {
    const result = parseFileName("PAYE John Smith (ABC123).pdf", "payslip");
    expect(result).toEqual({
      firstname: "John",
      lastname: "Smith",
      workerRef: "ABC123",
    });
  });

  it("parses a valid payslip filename without prefix", () => {
    const result = parseFileName("Jane Doe (ref001).pdf", "payslip");
    expect(result).toEqual({
      firstname: "Jane",
      lastname: "Doe",
      workerRef: "ref001",
    });
  });

  it("parses with multiple prefix words", () => {
    const result = parseFileName("Monthly Payroll Bob Jones (XYZ-789).pdf", "payslip");
    expect(result).toEqual({
      firstname: "Bob",
      lastname: "Jones",
      workerRef: "XYZ-789",
    });
  });

  it("parses filename with leading/trailing whitespace", () => {
    const result = parseFileName("  xxxxx firstname lastname (id).pdf  ", "payslip");
    expect(result).toEqual({
      firstname: "firstname",
      lastname: "lastname",
      workerRef: "id",
    });
  });

  it("handles mixed case", () => {
    const result = parseFileName("payslip John DOE (ABC123).pdf", "payslip");
    expect(result).toEqual({
      firstname: "John",
      lastname: "DOE",
      workerRef: "ABC123",
    });
  });

  it("returns null for empty string", () => {
    expect(parseFileName("", "payslip")).toBeNull();
  });

  it("returns null for whitespace-only", () => {
    expect(parseFileName("   ", "payslip")).toBeNull();
  });

  it("returns null for non-pdf extension", () => {
    expect(parseFileName("John Smith (ABC123).docx", "payslip")).toBeNull();
  });

  it("returns null for no extension", () => {
    expect(parseFileName("John Smith (ABC123)", "payslip")).toBeNull();
  });

  it("returns null when no parenthesised workerRef", () => {
    expect(parseFileName("John Smith ABC123.pdf", "payslip")).toBeNull();
  });

  it("returns null when only one name word before parens", () => {
    expect(parseFileName("Smith (ABC123).pdf", "payslip")).toBeNull();
  });

  it("returns null when firstname is empty before parens", () => {
    expect(parseFileName(" Smith (ABC123).pdf", "payslip")).toBeNull();
  });

  it("returns null when workerRef parens are empty", () => {
    expect(parseFileName("John Smith ().pdf", "payslip")).toBeNull();
  });

  it("returns null when no name before parens", () => {
    expect(parseFileName("(ABC123).pdf", "payslip")).toBeNull();
  });
});
