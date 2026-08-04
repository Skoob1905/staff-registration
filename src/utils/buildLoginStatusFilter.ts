import type { LoginStatusValue } from "../types/domain";

export function buildLoginStatusFilter(
  value: LoginStatusValue,
): { facetFilters?: string[][]; filterExpr?: string } {
  if (value === "all") return {};

  return { facetFilters: [[`metadata.loginStatus:${value}`]] };
}
