import { describe, it, expect } from "vitest";
import { buildFacetFilters, buildFacetRequestFields } from "./loginsFilter";

const staffKeyMap = { tag: "tags", agency: "metadata.assignedToRef" };
const loginsKeyMap = { tag: "tags", agency: "assignedTo" };

describe("buildFacetFilters", () => {
  it("returns empty array when no filters active", () => {
    const filters: Parameters<typeof buildFacetFilters>[0] = {
      name: "",
      typeIds: [],
      agencyIds: [],
      tagIds: [],
    };
    expect(buildFacetFilters(filters, staffKeyMap)).toEqual([]);
  });

  it("builds tag facet filter using keyMap.tag", () => {
    const filters = {
      name: "",
      typeIds: [],
      agencyIds: [],
      tagIds: ["t1", "t2"],
    };
    expect(buildFacetFilters(filters, staffKeyMap)).toEqual([
      ["tags:t1"],
      ["tags:t2"],
    ]);
  });

  it("builds agency facet filter using keyMap.agency for logins index", () => {
    const filters = {
      name: "",
      typeIds: [],
      agencyIds: ["a1"],
      tagIds: [],
    };
    expect(buildFacetFilters(filters, loginsKeyMap)).toEqual([
      ["assignedTo:a1"],
    ]);
  });

  it("builds agency facet filter using keyMap.agency for staff index", () => {
    const filters = {
      name: "",
      typeIds: [],
      agencyIds: ["a1"],
      tagIds: [],
    };
    expect(buildFacetFilters(filters, staffKeyMap)).toEqual([
      ["metadata.assignedToRef:a1"],
    ]);
  });

  it("combines tag (AND) and agency (OR) filters into separate groups", () => {
    const filters = {
      name: "",
      typeIds: [],
      agencyIds: ["a1"],
      tagIds: ["t1"],
    };
    const result = buildFacetFilters(filters, staffKeyMap);
    expect(result).toEqual([
      ["tags:t1"],
      ["metadata.assignedToRef:a1"],
    ]);
  });

  it("never includes metadata.uploadedBy when building staff facet filters", () => {
    const filters = {
      name: "",
      typeIds: [],
      agencyIds: ["cerobi"],
      tagIds: ["t1"],
    };
    const result = buildFacetFilters(filters, staffKeyMap);
    const allFilters = result.flat();
    const anyUploadedBy = allFilters.some((f) =>
      f.startsWith("metadata.uploadedBy"),
    );
    expect(anyUploadedBy).toBe(false);
  });

  it("only uses fields from the given FilterKeyMap, no unexpected fields", () => {
    const filters = {
      name: "",
      typeIds: [],
      agencyIds: ["cerobi"],
      tagIds: ["t1"],
    };
    const result = buildFacetFilters(filters, staffKeyMap);
    const allFilters = result.flat();
    const allowedPrefixes = Object.values(staffKeyMap).map((f) => `${f}:`);
    const allMatchKeyMap = allFilters.every((f) =>
      allowedPrefixes.some((p) => f.startsWith(p)),
    );
    expect(allMatchKeyMap).toBe(true);
  });

  it("handles multiple agencies in a single OR group", () => {
    const filters = {
      name: "",
      typeIds: [],
      agencyIds: ["a1", "a2"],
      tagIds: [],
    };
    expect(buildFacetFilters(filters, staffKeyMap)).toEqual([
      ["metadata.assignedToRef:a1", "metadata.assignedToRef:a2"],
    ]);
  });
});

describe("buildFacetRequestFields", () => {
  it("returns tag and agency from staff keyMap", () => {
    expect(buildFacetRequestFields(staffKeyMap)).toEqual([
      "tags",
      "metadata.assignedToRef",
    ]);
  });

  it("returns tag and agency from logins keyMap", () => {
    expect(buildFacetRequestFields(loginsKeyMap)).toEqual([
      "tags",
      "assignedTo",
    ]);
  });
});
