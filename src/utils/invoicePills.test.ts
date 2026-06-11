import { describe, it, expect } from "vitest";
import { renderInvoicePills } from "./invoicePills";

describe("renderInvoicePills", () => {
  it("returns zero counts for empty array", () => {
    expect(renderInvoicePills([])).toEqual({ unpaid: 0, paid: 0 });
  });

  it("counts a single unpaid invoice", () => {
    expect(renderInvoicePills([{ status: "unpaid" }])).toEqual({
      unpaid: 1,
      paid: 0,
    });
  });

  it("counts review as unpaid", () => {
    expect(renderInvoicePills([{ status: "review" }])).toEqual({
      unpaid: 1,
      paid: 0,
    });
  });

  it("counts a single paid invoice", () => {
    expect(renderInvoicePills([{ status: "paid" }])).toEqual({
      unpaid: 0,
      paid: 1,
    });
  });

  it("counts mixed statuses", () => {
    expect(
      renderInvoicePills([
        { status: "paid" },
        { status: "unpaid" },
        { status: "paid" },
        { status: "review" },
        { status: "unpaid" },
      ]),
    ).toEqual({ unpaid: 3, paid: 2 });
  });

  it("ignores unknown statuses", () => {
    expect(
      renderInvoicePills([
        { status: "paid" },
        { status: "unknown" },
        { status: "unpaid" },
      ]),
    ).toEqual({ unpaid: 1, paid: 1 });
  });
});
