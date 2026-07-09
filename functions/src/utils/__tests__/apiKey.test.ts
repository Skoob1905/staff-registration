import { describe, it, expect } from "vitest";
import { generateKey, computeExpiry } from "../apiKey.js";

describe("apiKeyUtils", () => {
  describe("generateKey", () => {
    it("returns a 10-character alphanumeric string", () => {
      const result = generateKey();
      expect(typeof result).toBe("string");
      expect(result).toMatch(/^[A-Za-z0-9]{10}$/);
    });

    it("generates unique keys each call", () => {
      const keys = new Set(
        Array.from({ length: 10 }, () => generateKey()),
      );
      expect(keys.size).toBe(10);
    });
  });

  describe("computeExpiry", () => {
    it("returns a Timestamp", () => {
      const result = computeExpiry();
      expect(result).toHaveProperty("seconds");
      expect(result).toHaveProperty("nanoseconds");
    });

    it("is between 88 and 93 days in the future", () => {
      const result = computeExpiry();
      const ms = result.seconds * 1000 + result.nanoseconds / 1e6;
      const now = Date.now();
      const diffMs = ms - now;
      const minMs = 88 * 24 * 60 * 60 * 1000;
      const maxMs = 93 * 24 * 60 * 60 * 1000;
      expect(diffMs).toBeGreaterThan(minMs);
      expect(diffMs).toBeLessThan(maxMs);
    });
  });
});
