import { describe, it, expect } from "vitest";
import {
  normalizeKey,
  hasAgencyRefColumn,
  hasClientRefColumn,
  hasWorkerRefColumn,
} from "./keyHeaderNormalisation";

describe("normalizeKey", () => {
  it("strips spaces and lowercases", () => {
    expect(normalizeKey("NI Number")).toBe("ninumber");
  });

  it("strips dots", () => {
    expect(normalizeKey("N.I. Number")).toBe("ninumber");
  });

  it("strips hash", () => {
    expect(normalizeKey("NI#")).toBe("ni");
  });
});

describe("hasAgencyRefColumn", () => {
  it("returns true for 'Ref'", () => {
    expect(hasAgencyRefColumn(["Ref"])).toBe(true);
  });

  it("returns true for 'Reference'", () => {
    expect(hasAgencyRefColumn(["Reference"])).toBe(true);
  });

  it("returns true for 'Agency Ref'", () => {
    expect(hasAgencyRefColumn(["Agency Ref"])).toBe(true);
  });

  it("returns false for unrelated headers", () => {
    expect(hasAgencyRefColumn(["Name", "Email"])).toBe(false);
  });
});

describe("hasClientRefColumn", () => {
  it("returns true for 'Ref'", () => {
    expect(hasClientRefColumn(["Ref"])).toBe(true);
  });

  it("returns true for 'Reference'", () => {
    expect(hasClientRefColumn(["Reference"])).toBe(true);
  });

  it("returns true for 'Client Ref'", () => {
    expect(hasClientRefColumn(["Client Ref"])).toBe(true);
  });

  it("returns false for unrelated headers", () => {
    expect(hasClientRefColumn(["Name", "Email"])).toBe(false);
  });
});

describe("hasWorkerRefColumn", () => {
  it("returns true for 'Ref'", () => {
    expect(hasWorkerRefColumn(["Ref"])).toBe(true);
  });

  it("returns true for 'Worker Ref'", () => {
    expect(hasWorkerRefColumn(["Worker Ref"])).toBe(true);
  });

  it("returns false for unrelated headers", () => {
    expect(hasWorkerRefColumn(["Name", "Email"])).toBe(false);
  });
});
