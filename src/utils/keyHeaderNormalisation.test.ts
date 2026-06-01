import { describe, it, expect } from "vitest";
import { hasNIColumn, getNINumber, normalizeKey, hasBusinessNameColumn, getBusinessName } from "./keyHeaderNormalisation";

describe("hasNIColumn", () => {
  it("returns true for 'NI Number'", () => {
    expect(hasNIColumn(["NI Number"])).toBe(true);
  });

  it("returns true for 'NI No'", () => {
    expect(hasNIColumn(["NI No"])).toBe(true);
  });

  it("returns true for 'National Insurance Number'", () => {
    expect(hasNIColumn(["National Insurance Number"])).toBe(true);
  });

  it("returns true for 'National Insurance No'", () => {
    expect(hasNIColumn(["National Insurance No"])).toBe(true);
  });

  it("returns true for 'NINO'", () => {
    expect(hasNIColumn(["NINO"])).toBe(true);
  });

  it("returns true for 'NI#'", () => {
    expect(hasNIColumn(["NI#"])).toBe(true);
  });

  it("returns true for 'NI_Number'", () => {
    expect(hasNIColumn(["NI_Number"])).toBe(true);
  });

  it("returns true for 'N.I. Number'", () => {
    expect(hasNIColumn(["N.I. Number"])).toBe(true);
  });

  it("returns true for 'National Insurance'", () => {
    expect(hasNIColumn(["National Insurance"])).toBe(true);
  });

  it("returns true for 'Nat Ins No'", () => {
    expect(hasNIColumn(["Nat Ins No"])).toBe(true);
  });

  it("returns true for 'SSN'", () => {
    expect(hasNIColumn(["SSN"])).toBe(true);
  });

  it("returns true for 'Social Security Number'", () => {
    expect(hasNIColumn(["Social Security Number"])).toBe(true);
  });

  it("returns true for 'NIN'", () => {
    expect(hasNIColumn(["NIN"])).toBe(true);
  });

  it("returns true for 'NI'", () => {
    expect(hasNIColumn(["NI"])).toBe(true);
  });

  it("returns true for 'National Insurance #'", () => {
    expect(hasNIColumn(["National Insurance #"])).toBe(true);
  });

  it("returns false for unrelated headers", () => {
    expect(hasNIColumn(["Name", "Email", "Phone"])).toBe(false);
  });

  it("returns true when NI column is among other headers", () => {
    expect(hasNIColumn(["Name", "NI Number", "Email"])).toBe(true);
  });

  it("returns false for empty headers", () => {
    expect(hasNIColumn([])).toBe(false);
  });

  it("handles case insensitivity - 'ni number'", () => {
    expect(hasNIColumn(["ni number"])).toBe(true);
  });

  it("handles case insensitivity - 'national insurance number'", () => {
    expect(hasNIColumn(["national insurance number"])).toBe(true);
  });
});

describe("getNINumber", () => {
  it("returns the value for a matching NI column", () => {
    expect(getNINumber({ "NI Number": "AB123456C" })).toBe("AB123456C");
  });

  it("returns empty string when no NI column exists", () => {
    expect(getNINumber({ Name: "John" })).toBe("");
  });

  it("returns empty string for empty row", () => {
    expect(getNINumber({})).toBe("");
  });
});

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

describe("hasBusinessNameColumn", () => {
  it("returns true for 'Business Name'", () => {
    expect(hasBusinessNameColumn(["Business Name"])).toBe(true);
  });

  it("returns true for 'Company'", () => {
    expect(hasBusinessNameColumn(["Company"])).toBe(true);
  });

  it("returns true for 'Company Name'", () => {
    expect(hasBusinessNameColumn(["Company Name"])).toBe(true);
  });

  it("returns false for unrelated headers", () => {
    expect(hasBusinessNameColumn(["Name", "Email"])).toBe(false);
  });
});

describe("getBusinessName", () => {
  it("returns the value for a matching Business Name column", () => {
    expect(getBusinessName({ "Business Name": "Acme Ltd" })).toBe("Acme Ltd");
  });

  it("returns empty string when no business name column exists", () => {
    expect(getBusinessName({ Name: "John" })).toBe("");
  });

  it("returns empty string for empty row", () => {
    expect(getBusinessName({})).toBe("");
  });
});
