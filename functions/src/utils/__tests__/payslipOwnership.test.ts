import { describe, it, expect } from "vitest";
import { isPayslipOwner } from "../payslipOwnership.js";

describe("isPayslipOwner", () => {
  it("returns true when a staff doc id matches the payslip userId", () => {
    expect(isPayslipOwner(["AB123456C"], "AB123456C")).toBe(true);
  });

  it("matches case-insensitively (payslip userId is uppercased)", () => {
    expect(isPayslipOwner(["ab123456c"], "AB123456C")).toBe(true);
    expect(isPayslipOwner(["AB123456C"], "ab123456c")).toBe(true);
  });

  it("returns true when any of the caller's staff records match", () => {
    expect(isPayslipOwner(["OTHER", "AB123456C"], "AB123456C")).toBe(true);
  });

  it("returns false when no staff doc id matches", () => {
    expect(isPayslipOwner(["OTHER", "ZZ999999Z"], "AB123456C")).toBe(false);
  });

  it("returns false when there are no staff records", () => {
    expect(isPayslipOwner([], "AB123456C")).toBe(false);
  });

  it("returns false for an empty payslip userId", () => {
    expect(isPayslipOwner(["AB123456C"], "")).toBe(false);
    expect(isPayslipOwner(["AB123456C"], "   ")).toBe(false);
  });

  it("trims surrounding whitespace before comparing", () => {
    expect(isPayslipOwner([" AB123456C "], "AB123456C")).toBe(true);
  });
});
