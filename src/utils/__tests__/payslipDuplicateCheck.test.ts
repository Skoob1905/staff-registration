import { describe, it, expect } from "vitest";
import { checkDuplicatePayslip } from "../payslipDuplicateCheck";

describe("checkDuplicatePayslip", () => {
  it("returns no duplicates when no existing payslips", async () => {
    const fetchExistingNames = async () => [];
    const result = await checkDuplicatePayslip(
      [{ workerRef: "ABC123", displayName: "Payslip for Week 10.pdf" }],
      fetchExistingNames,
    );
    expect(result).toEqual([
      { workerRef: "ABC123", displayName: "Payslip for Week 10.pdf", isDuplicate: false },
    ]);
  });

  it("marks a file as duplicate when filename exists", async () => {
    const fetchExistingNames = async () => ["Payslip for Week 10.pdf"];
    const result = await checkDuplicatePayslip(
      [{ workerRef: "ABC123", displayName: "Payslip for Week 10.pdf" }],
      fetchExistingNames,
    );
    expect(result).toEqual([
      { workerRef: "ABC123", displayName: "Payslip for Week 10.pdf", isDuplicate: true },
    ]);
  });

  it("correctly handles a mix of duplicates and non-duplicates", async () => {
    const fetchExistingNames = async (ref: string) => {
      if (ref === "ABC123") return ["Payslip for Week 10.pdf"];
      return [];
    };
    const result = await checkDuplicatePayslip(
      [
        { workerRef: "ABC123", displayName: "Payslip for Week 10.pdf" },
        { workerRef: "ABC123", displayName: "Payslip for Week 11.pdf" },
        { workerRef: "XYZ789", displayName: "Payslip for Week 5.pdf" },
      ],
      fetchExistingNames,
    );
    expect(result).toEqual([
      { workerRef: "ABC123", displayName: "Payslip for Week 10.pdf", isDuplicate: true },
      { workerRef: "ABC123", displayName: "Payslip for Week 11.pdf", isDuplicate: false },
      { workerRef: "XYZ789", displayName: "Payslip for Week 5.pdf", isDuplicate: false },
    ]);
  });

  it("handles different workerRefs independently", async () => {
    const fetchExistingNames = async (ref: string) => {
      if (ref === "ABC123") return ["Payslip for Week 10.pdf"];
      if (ref === "DEF456") return ["Payslip for Week 10.pdf"];
      return [];
    };
    const result = await checkDuplicatePayslip(
      [
        { workerRef: "ABC123", displayName: "Payslip for Week 10.pdf" },
        { workerRef: "DEF456", displayName: "Payslip for Week 10.pdf" },
      ],
      fetchExistingNames,
    );
    expect(result).toEqual([
      { workerRef: "ABC123", displayName: "Payslip for Week 10.pdf", isDuplicate: true },
      { workerRef: "DEF456", displayName: "Payslip for Week 10.pdf", isDuplicate: true },
    ]);
  });

  it("returns empty array for empty input", async () => {
    const fetchExistingNames = async () => [];
    const result = await checkDuplicatePayslip([], fetchExistingNames);
    expect(result).toEqual([]);
  });

  it("deduplicates fetch calls per workerRef", async () => {
    let callCount = 0;
    const fetchExistingNames = async () => {
      callCount++;
      return ["Payslip for Week 10.pdf"];
    };
    const result = await checkDuplicatePayslip(
      [
        { workerRef: "ABC123", displayName: "Payslip for Week 10.pdf" },
        { workerRef: "ABC123", displayName: "Payslip for Week 11.pdf" },
        { workerRef: "ABC123", displayName: "Payslip for Week 12.pdf" },
      ],
      fetchExistingNames,
    );
    expect(callCount).toBe(1);
    expect(result).toEqual([
      { workerRef: "ABC123", displayName: "Payslip for Week 10.pdf", isDuplicate: true },
      { workerRef: "ABC123", displayName: "Payslip for Week 11.pdf", isDuplicate: false },
      { workerRef: "ABC123", displayName: "Payslip for Week 12.pdf", isDuplicate: false },
    ]);
  });
});
