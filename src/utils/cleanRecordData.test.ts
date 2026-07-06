import { describe, it, expect } from "vitest";
import { cleanRecordData } from "./cleanRecordData";

describe("cleanRecordData", () => {
  it("returns sorted key-value pairs skipping internal fields", () => {
    const result = cleanRecordData({
      id: "abc123",
      name: "Alice",
      age: 30,
      metadata: '{"key":"val"}',
      tags: ["staff"],
      sortableName: "alice",
    });

    expect(result).toEqual({ age: "30", name: "Alice" });
  });

  it("keeps boolean and number values as strings", () => {
    const result = cleanRecordData({
      active: true,
      count: 42,
      title: "Engineer",
    });

    expect(result).toEqual({ active: "true", count: "42", title: "Engineer" });
  });

  it("filters out null, undefined, object, and array values", () => {
    const result = cleanRecordData({
      name: "Bob",
      address: null,
      note: undefined,
      items: [1, 2, 3],
      nested: { a: 1 },
    });

    expect(result).toEqual({ name: "Bob" });
  });

  it("respects extraSkip parameter", () => {
    const result = cleanRecordData(
      {
        name: "Carol",
        email: "carol@test.com",
        internalNote: "hidden",
      },
      ["internalNote"],
    );

    expect(result).toEqual({ email: "carol@test.com", name: "Carol" });
  });

  it("returns sorted by label alphabetically", () => {
    const result = cleanRecordData({
      zebra: "A",
      alpha: "B",
      charlie: "C",
    });

    expect(Object.keys(result)).toEqual(["alpha", "charlie", "zebra"]);
  });

  it("returns empty object when all fields are skipped", () => {
    const result = cleanRecordData({
      id: "1",
      metadata: "x",
      sortableName: "y",
    });

    expect(result).toEqual({});
  });
});
