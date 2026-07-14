import { describe, it, expect } from "vitest";
import { editFileName } from "../editFileName";

describe("editFileName", () => {
  it("extracts Payslip for Week 10 from a full payslip filename", () => {
    expect(
      editFileName("PAYE John Smith Week 10 (ABC123).pdf"),
    ).toBe("Payslip for Week 10.pdf");
  });

  it("extracts Payslip for Week 14 from a multi-word prefix", () => {
    expect(
      editFileName("Weekly Payroll Jane Doe Week 14 (ref001).pdf"),
    ).toBe("Payslip for Week 14.pdf");
  });

  it("extracts Payslip for Week 1 at the start of the name", () => {
    expect(editFileName("Week 1 Bob Jones (XYZ-789).pdf")).toBe("Payslip for Week 1.pdf");
  });

  it("is case-insensitive with 'week'", () => {
    expect(
      editFileName("PAYE John Smith week 10 (ABC123).pdf"),
    ).toBe("Payslip for Week 10.pdf");
  });

  it("is case-insensitive with 'WEEK'", () => {
    expect(
      editFileName("PAYE John Smith WEEK 14 (ABC123).pdf"),
    ).toBe("Payslip for Week 14.pdf");
  });

  it("handles multi-digit week numbers", () => {
    expect(
      editFileName("PAYE John Smith Week 100 (ABC123).pdf"),
    ).toBe("Payslip for Week 100.pdf");
  });

  it("returns original filename when no Week pattern is found", () => {
    const name = "PAYE John Smith (ABC123).pdf";
    expect(editFileName(name)).toBe(name);
  });

  it("returns original filename for a bare name with no week", () => {
    const name = "Bob Jones (XYZ-789).pdf";
    expect(editFileName(name)).toBe(name);
  });

  it("returns first Week match if multiple appear", () => {
    expect(
      editFileName("Week 5 Review Week 10 (ABC123).pdf"),
    ).toBe("Payslip for Week 5.pdf");
  });

  it("handles filename with no pdf extension", () => {
    expect(editFileName("Week 3")).toBe("Payslip for Week 3.pdf");
  });
});
