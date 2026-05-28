export function validateLoginEmail(
  email: string,
  allowedDomains: string[],
  companySlug: string,
): string | null {
  const trimmed = email.trim();
  const local = trimmed.split("@")[0]?.toLowerCase();
  const domain = trimmed.split("@")[1]?.toLowerCase();

  if (
    local === "admin" &&
    allowedDomains.length > 0 &&
    domain &&
    !allowedDomains.includes(domain)
  ) {
    return `Please use a ${companySlug} email address.`;
  }

  return null;
}

