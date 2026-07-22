import type { LoginStatusValue } from "../types/domain";

const SENT = ["awaiting_login", "password_set", "logged_in"] as const;

export function buildLoginStatusFilter(
  value: LoginStatusValue,
): { facetFilters?: string[][]; filterExpr?: string } {
  if (value === "all") return {};

  if (value === "sent") {
    return { facetFilters: [SENT.map((s) => `metadata.loginStatus:${s}`)] };
  }

  return {
    filterExpr: SENT.map((s) => `NOT metadata.loginStatus:${s}`).join(" AND "),
  };
}
