import { describe, it, expect } from "vitest";
import { getColumns } from "../columns";

describe("getColumns", () => {
  it("returns payslip columns when type is 'payslip'", () => {
    const columns = getColumns("payslip");

    expect(columns).toHaveLength(6);
    expect(columns[0].header).toBe("Status");
    expect(columns[1].header).toBe("File Name");
    expect(columns[2].header).toBe("First Name");
    expect(columns[3].header).toBe("Last Name");
    expect(columns[4].header).toBe("Worker Ref");
    expect(columns[5].header).toBe("Email");
  });

  it("returns empty array for unknown type", () => {
    const columns = getColumns("cv");

    expect(columns).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    const columns = getColumns("");

    expect(columns).toEqual([]);
  });

  it("each payslip column has a header and cell function", () => {
    const columns = getColumns("payslip");

    for (const col of columns) {
      expect(col).toHaveProperty("header");
      expect(col).toHaveProperty("cell");
      expect(typeof col.header).toBe("string");
      expect(typeof col.cell).toBe("function");
    }
  });
});
