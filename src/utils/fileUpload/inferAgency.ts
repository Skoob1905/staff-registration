import type { AgencyOption } from "../../hooks/useAgencies";

export type AgencyInference =
  | { status: "matched"; agency: AgencyOption }
  | { status: "none" }
  | { status: "ambiguous"; matches: AgencyOption[] };

const MIN_TOKEN_LENGTH = 3;

function tokenize(value: string): string[] {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= MIN_TOKEN_LENGTH);
}

export function tokenizeFileName(fileName: string): string[] {
  return tokenize(fileName.replace(/\.[^./\\]+$/, ""));
}

export function tokenizeAgencyName(name: string): string[] {
  return tokenize(name);
}

export function inferAgencyFromFileName(
  fileName: string,
  agencies: AgencyOption[],
): AgencyInference {
  const fileTokens = [...new Set(tokenizeFileName(fileName))];
  if (fileTokens.length === 0) return { status: "none" };

  const matches = agencies.filter((agency) => {
    const agencyTokens = new Set(tokenizeAgencyName(agency.name));
    return fileTokens.some((token) => agencyTokens.has(token));
  });

  if (matches.length === 0) return { status: "none" };
  if (matches.length > 1) return { status: "ambiguous", matches };
  return { status: "matched", agency: matches[0] };
}
