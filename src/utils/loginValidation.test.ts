import { describe, it, expect } from "vitest";
import { validateLoginEmail } from "./loginValidation";

describe("validateLoginEmail", () => {
  const domains = ["blackrockconsultancyuk.com"];
  const slug = "blackrock";

  it("returns null for a non-admin email from any domain", () => {
    expect(validateLoginEmail("staff@gmail.com", domains, slug)).toBeNull();
  });

  it("returns null for a non-admin email from an allowed domain", () => {
    expect(
      validateLoginEmail("staff@blackrockconsultancyuk.com", domains, slug),
    ).toBeNull();
  });

  it("returns null for admin email from an allowed domain", () => {
    expect(
      validateLoginEmail("admin@blackrockconsultancyuk.com", domains, slug),
    ).toBeNull();
  });

  it("returns error for admin email from a blocked domain", () => {
    expect(validateLoginEmail("admin@gmail.com", domains, slug)).toBe(
      "Please use a blackrock email address.",
    );
  });

  it("handles case-insensitive local part", () => {
    expect(validateLoginEmail("Admin@gmail.com", domains, slug)).toBe(
      "Please use a blackrock email address.",
    );
  });

  it("handles case-insensitive domain match", () => {
    expect(
      validateLoginEmail("admin@BlackrockConsultancyUK.com", domains, slug),
    ).toBeNull();
  });

  it("returns null when allowedDomains is empty (no restriction)", () => {
    expect(validateLoginEmail("admin@gmail.com", [], slug)).toBeNull();
  });

  it("uses the provided company slug in the error message", () => {
    expect(
      validateLoginEmail("admin@yahoo.com", ["cerobigroup-uk.com"], "cerobi"),
    ).toBe("Please use a cerobi email address.");
  });

  it("returns null when the email has no domain", () => {
    expect(validateLoginEmail("admin@", domains, slug)).toBeNull();
  });

  it("trims whitespace from email", () => {
    expect(validateLoginEmail("  admin@gmail.com  ", domains, slug)).toBe(
      "Please use a blackrock email address.",
    );
  });
});
