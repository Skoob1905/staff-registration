import { describe, expect, it } from "vitest";
import {
  inferAgencyFromFileName,
  tokenizeAgencyName,
  tokenizeFileName,
} from "../inferAgency";
import type { AgencyOption } from "../../../hooks/useAgencies";

const agencies: AgencyOption[] = [
  { id: "1", name: "Imperial Consultants" },
  { id: "2", name: "Acme Recruitment" },
  { id: "3", name: "Imperial Staffing" },
  { id: "4", name: "Sparta Solutions" },
];

describe("tokenizeFileName", () => {
  it("strips extension, case, digits and punctuation", () => {
    expect(tokenizeFileName("imperial30.csv")).toEqual(["imperial"]);
    expect(tokenizeFileName("IMPERIAL_30.XLSX")).toEqual(["imperial"]);
    expect(tokenizeFileName("imperial-consultants-30.csv")).toEqual([
      "imperial",
      "consultants",
    ]);
  });

  it("keeps space-separated words as separate tokens", () => {
    expect(
      tokenizeFileName("Imperial Consultants - March 2026.xlsx"),
    ).toEqual(["imperial", "consultants", "march"]);
    expect(tokenizeFileName("  acme   recruitment  ")).toEqual([
      "acme",
      "recruitment",
    ]);
  });

  it("removes accents and ignores tokens shorter than three characters", () => {
    expect(tokenizeFileName("café 24-7 ab abc.csv")).toEqual(["cafe", "abc"]);
  });
});

describe("tokenizeAgencyName", () => {
  it("splits agency names into lowercase word tokens", () => {
    expect(tokenizeAgencyName("Imperial Consultants")).toEqual([
      "imperial",
      "consultants",
    ]);
    expect(tokenizeAgencyName("Imperial-Staffing Ltd.")).toEqual([
      "imperial",
      "staffing",
      "ltd",
    ]);
  });
});

describe("inferAgencyFromFileName", () => {
  it("matches imperial30.csv to Imperial Consultants", () => {
    expect(
      inferAgencyFromFileName("imperial30.csv", [agencies[0]]),
    ).toEqual({
      status: "matched",
      agency: agencies[0],
    });
  });

  it("matches spaced filenames by any token", () => {
    expect(
      inferAgencyFromFileName("Imperial Consultants March 2026.xlsx", [
        agencies[0],
      ]),
    ).toEqual({
      status: "matched",
      agency: agencies[0],
    });
  });

  it("ignores extra unrelated tokens", () => {
    expect(
      inferAgencyFromFileName("Acme Recruitment March 2026.xlsx", agencies),
    ).toEqual({
      status: "matched",
      agency: agencies[1],
    });
  });

  it("matches punctuation-separated filenames", () => {
    expect(
      inferAgencyFromFileName("imperial_consultants_30.xlsx", [agencies[0]]),
    ).toEqual({
      status: "matched",
      agency: agencies[0],
    });
  });

  it("returns none when no token matches", () => {
    expect(inferAgencyFromFileName("unknown30.csv", agencies)).toEqual({
      status: "none",
    });
  });

  it("returns none for a token that only appears as a substring", () => {
    expect(inferAgencyFromFileName("art.csv", agencies)).toEqual({
      status: "none",
    });
  });

  it("returns ambiguous when a token matches multiple agencies", () => {
    const result = inferAgencyFromFileName("imperial30.csv", agencies);
    expect(result.status).toBe("ambiguous");
    if (result.status === "ambiguous") {
      expect(result.matches.map((a) => a.id)).toEqual(["1", "3"]);
    }
  });

  it("returns ambiguous when different tokens match different agencies", () => {
    const result = inferAgencyFromFileName("Acme Imperial.csv", agencies);
    expect(result.status).toBe("ambiguous");
    if (result.status === "ambiguous") {
      expect(result.matches.map((a) => a.id)).toEqual(["1", "2", "3"]);
    }
  });

  it("ignores short filename tokens", () => {
    expect(inferAgencyFromFileName("ab acme.csv", agencies)).toEqual({
      status: "matched",
      agency: agencies[1],
    });
  });

  it("handles duplicate filename tokens", () => {
    expect(inferAgencyFromFileName("acme acme.csv", agencies)).toEqual({
      status: "matched",
      agency: agencies[1],
    });
  });

  it("handles empty agency lists", () => {
    expect(inferAgencyFromFileName("imperial30.csv", [])).toEqual({
      status: "none",
    });
  });

  it("handles filenames with no usable tokens", () => {
    expect(inferAgencyFromFileName("30.csv", agencies)).toEqual({
      status: "none",
    });
  });
});
