export const getCompanyName = (company: Record<string, unknown> | undefined | null): string => {
  if (!company || typeof company !== "object") return "Unknown";
  const nameKey = Object.keys(company).find((key) =>
    /^(company.?name|name|agency.?name|business.?name|organisation|company)$/i.test(
      key.replace(/[\s_-]+/g, ""),
    ),
  );
  return nameKey ? String(company[nameKey] ?? "") || "Unknown" : "Unknown";
};
