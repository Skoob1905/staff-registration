import { describe, it, expect } from "vitest";
import { getStaffRef } from "../getFileRef.js";

describe("getStaffRef", () => {
  it("extracts from 'Ref'", () => {
    expect(getStaffRef({ Ref: "AB123456C" })).toBe("AB123456C");
  });

  it("extracts from 'Reference'", () => {
    expect(getStaffRef({ Reference: "AB123456C" })).toBe("AB123456C");
  });

  it("extracts from 'WorkersRef'", () => {
    expect(getStaffRef({ WorkersRef: "AB123456C" })).toBe("AB123456C");
  });

  it("extracts from 'Workers Ref'", () => {
    expect(getStaffRef({ "Workers Ref": "AB123456C" })).toBe("AB123456C");
  });

  it("handles case insensitivity - 'ref'", () => {
    expect(getStaffRef({ ref: "AB123456C" })).toBe("AB123456C");
  });

  it("handles case insensitivity - 'workersref'", () => {
    expect(getStaffRef({ workersref: "AB123456C" })).toBe("AB123456C");
  });

  it("returns first matching key", () => {
    expect(getStaffRef({ Ref: "FIRST", Reference: "SECOND" })).toBe("FIRST");
  });

  it("returns empty string when no match exists", () => {
    expect(getStaffRef({ Name: "John", Email: "john@test.com" })).toBe("");
  });

  it("returns empty string for empty record", () => {
    expect(getStaffRef({})).toBe("");
  });

  it("converts non-string values to string", () => {
    expect(getStaffRef({ Ref: 12345 })).toBe("12345");
  });

  it("handles null value", () => {
    expect(getStaffRef({ Ref: null })).toBe("");
  });

  it("handles undefined value", () => {
    expect(getStaffRef({ Ref: undefined })).toBe("");
  });

  it("does not match 'NI Number'", () => {
    expect(getStaffRef({ "NI Number": "AB123456C" })).toBe("");
  });

  it("does not match 'NINO'", () => {
    expect(getStaffRef({ NINO: "AB123456C" })).toBe("");
  });
});
