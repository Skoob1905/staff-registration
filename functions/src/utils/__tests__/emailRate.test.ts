import { describe, expect, it } from "vitest";
import { getEmailRate } from "../emailRate";

describe("getEmailRate", () => {
  it("returns 1000ms for 3600 emails per hour", () => {
    expect(getEmailRate(3600)).toBe(1000);
  });

  it("returns 2000ms for 1800 emails per hour", () => {
    expect(getEmailRate(1800)).toBe(2000);
  });

  it("returns 500ms for 7200 emails per hour", () => {
    expect(getEmailRate(7200)).toBe(500);
  });

  it("returns 10000ms for 360 emails per hour", () => {
    expect(getEmailRate(360)).toBe(10000);
  });

  it("returns 100ms for 36000 emails per hour", () => {
    expect(getEmailRate(36000)).toBe(100);
  });

  it("returns fallback 1000ms for zero", () => {
    expect(getEmailRate(0)).toBe(1000);
  });

  it("returns fallback 1000ms for negative", () => {
    expect(getEmailRate(-100)).toBe(1000);
  });

  it("rounds to nearest millisecond", () => {
    const result = getEmailRate(7);
    expect(result).toBe(Math.round(3600000 / 7));
  });
});
