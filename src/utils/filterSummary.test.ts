import { describe, expect, it } from "vitest";
import { buildFilterSummary } from "./filterSummary";
import type { StaffFilters } from "../types/domain";

const empty: StaffFilters = {
  name: "",
  typeIds: [],
  agencyIds: [],
  tagIds: [],
};

describe("buildFilterSummary", () => {
  it("returns an empty string when there are no filters", () => {
    expect(buildFilterSummary(empty)).toBe("");
  });

  it("ignores search text shorter than 3 characters", () => {
    expect(buildFilterSummary({ ...empty, name: "ab" })).toBe("");
  });

  it("includes the search text when at least 3 characters", () => {
    expect(buildFilterSummary({ ...empty, name: "jane" })).toBe("jane");
  });

  it("trims the search text", () => {
    expect(buildFilterSummary({ ...empty, name: "  jane  " })).toBe("jane");
  });

  it("maps tag ids to their names", () => {
    expect(
      buildFilterSummary(
        { ...empty, tagIds: ["t1", "t2"] },
        { tags: { t1: "Driver", t2: "Chef" } },
      ),
    ).toBe("Driver, Chef");
  });

  it("maps agency ids to their names", () => {
    expect(
      buildFilterSummary(
        { ...empty, agencyIds: ["a1"] },
        { agencies: { a1: "Acme Corp" } },
      ),
    ).toBe("Acme Corp");
  });

  it("falls back to the raw id when no name is resolved", () => {
    expect(buildFilterSummary({ ...empty, tagIds: ["t1"] })).toBe("t1");
    expect(buildFilterSummary({ ...empty, agencyIds: ["a1"] })).toBe("a1");
  });

  it("joins name, tags and agencies with commas", () => {
    expect(
      buildFilterSummary(
        { ...empty, name: "jane", tagIds: ["t1"], agencyIds: ["a1"] },
        { tags: { t1: "Driver" }, agencies: { a1: "Acme Corp" } },
      ),
    ).toBe("jane, Driver, Acme Corp");
  });

  it("respects the include flags", () => {
    expect(
      buildFilterSummary(
        { ...empty, name: "jane", tagIds: ["t1"], agencyIds: ["a1"] },
        { tags: { t1: "Driver" }, agencies: { a1: "Acme Corp" } },
        { includeTags: false, includeAgencies: false },
      ),
    ).toBe("jane");
  });

  it("respects a custom minimum name length", () => {
    expect(
      buildFilterSummary({ ...empty, name: "ab" }, {}, { minNameLength: 2 }),
    ).toBe("ab");
  });
});
