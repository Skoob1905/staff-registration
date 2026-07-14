import { describe, it, expect } from "vitest";
import { parseFileName } from "../parseFileName";

describe("parseFileName (payslip)", () => {
  it("parses a valid payslip filename", () => {
    const result = parseFileName("john_smith_ABC123.pdf", "payslip");
    expect(result).toEqual({
      firstname: "john",
      lastname: "smith",
      workerRef: "ABC123",
    });
  });

  it("parses with mixed case", () => {
    const result = parseFileName("John_SMITH_xyz-789.pdf", "payslip");
    expect(result).toEqual({
      firstname: "John",
      lastname: "SMITH",
      workerRef: "xyz-789",
    });
  });

  it("parses filename with leading/trailing whitespace", () => {
    const result = parseFileName("  jane_doe_ref001.pdf  ", "payslip");
    expect(result).toEqual({
      firstname: "jane",
      lastname: "doe",
      workerRef: "ref001",
    });
  });

  it("handles _ in workerRef part", () => {
    const result = parseFileName("first_last_ref_001.pdf", "payslip");
    expect(result).toEqual({
      firstname: "first",
      lastname: "last",
      workerRef: "ref_001",
    });
  });

  it("returns null for empty string", () => {
    expect(parseFileName("", "payslip")).toBeNull();
  });

  it("returns null for whitespace-only", () => {
    expect(parseFileName("   ", "payslip")).toBeNull();
  });

  it("returns null for non-pdf extension", () => {
    expect(parseFileName("john_smith_ABC123.docx", "payslip")).toBeNull();
  });

  it("returns null for no extension", () => {
    expect(parseFileName("john_smith_ABC123", "payslip")).toBeNull();
  });

  it("returns null for only two parts", () => {
    expect(parseFileName("john_smith.pdf", "payslip")).toBeNull();
  });

  it("returns null for only one part", () => {
    expect(parseFileName("john.pdf", "payslip")).toBeNull();
  });

  it("returns null when firstname is empty", () => {
    expect(parseFileName("_smith_ABC123.pdf", "payslip")).toBeNull();
  });

  it("returns null when lastname is empty", () => {
    expect(parseFileName("john__ABC123.pdf", "payslip")).toBeNull();
  });

  it("returns null when workerRef is empty", () => {
    expect(parseFileName("john_smith_.pdf", "payslip")).toBeNull();
  });
});
