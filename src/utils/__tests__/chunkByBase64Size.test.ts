import { describe, it, expect } from "vitest";
import { chunkByBase64Size } from "../chunkByBase64Size";

const entry = (size: number) => ({ fileBase64: "a".repeat(size) });

describe("chunkByBase64Size", () => {
  it("returns an empty array for no entries", () => {
    expect(chunkByBase64Size([])).toEqual([]);
  });

  it("keeps entries in a single batch when under the budget", () => {
    const entries = [entry(10), entry(10), entry(10)];
    expect(chunkByBase64Size(entries, 100)).toEqual([entries]);
  });

  it("splits into multiple batches when the budget is exceeded", () => {
    const entries = [entry(10), entry(10), entry(10)];
    expect(chunkByBase64Size(entries, 20)).toEqual([
      [entries[0], entries[1]],
      [entries[2]],
    ]);
  });

  it("emits an oversized entry as its own batch rather than dropping it", () => {
    const entries = [entry(10), entry(50), entry(10)];
    expect(chunkByBase64Size(entries, 20)).toEqual([
      [entries[0]],
      [entries[1]],
      [entries[2]],
    ]);
  });

  it("preserves input order across batches", () => {
    const entries = [entry(5), entry(5), entry(5), entry(5)];
    const flat = chunkByBase64Size(entries, 10).flat();
    expect(flat).toEqual(entries);
  });

  it("splits by item count when the byte budget is not reached", () => {
    const entries = [entry(1), entry(1), entry(1), entry(1), entry(1)];
    expect(chunkByBase64Size(entries, 1_000_000, 2)).toEqual([
      [entries[0], entries[1]],
      [entries[2], entries[3]],
      [entries[4]],
    ]);
  });

  it("does not mutate the input array", () => {
    const entries = [entry(10), entry(10)];
    const copy = [...entries];
    chunkByBase64Size(entries, 10);
    expect(entries).toEqual(copy);
  });
});
