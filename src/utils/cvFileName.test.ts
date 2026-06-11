import { describe, it, expect } from "vitest";
import { parseCVFileName } from "./cvFileName";

describe("parseCVFileName", () => {
  it("parses space-separated filename", () => {
    const result = parseCVFileName("john smith.pdf");
    expect(result).toEqual({ firstname: "John", surname: "Smith", fullname: "John Smith" });
  });

  it("parses CamelCase filename", () => {
    const result = parseCVFileName("josephMeyrick.pdf");
    expect(result).toEqual({ firstname: "Joseph", surname: "Meyrick", fullname: "Joseph Meyrick" });
  });

  it("parses PascalCase filename", () => {
    const result = parseCVFileName("JosephMeyrick.pdf");
    expect(result).toEqual({ firstname: "Joseph", surname: "Meyrick", fullname: "Joseph Meyrick" });
  });

  it("parses kebab-case filename", () => {
    const result = parseCVFileName("joseph-meyrick.pdf");
    expect(result).toEqual({ firstname: "Joseph", surname: "Meyrick", fullname: "Joseph Meyrick" });
  });

  it("parses snake_case filename", () => {
    const result = parseCVFileName("joseph_meyrick.pdf");
    expect(result).toEqual({ firstname: "Joseph", surname: "Meyrick", fullname: "Joseph Meyrick" });
  });

  it("handles multi-word surname with space", () => {
    const result = parseCVFileName("John Smith Jr.pdf");
    expect(result).toEqual({ firstname: "John", surname: "Smith Jr", fullname: "John Smith Jr" });
  });

  it("handles multi-word surname with kebab", () => {
    const result = parseCVFileName("jean-claude van-damme.pdf");
    expect(result).toEqual({ firstname: "Jean", surname: "Claude Van Damme", fullname: "Jean Claude Van Damme" });
  });

  it("handles multi-word surname with underscore", () => {
    const result = parseCVFileName("mary_ann_evans.pdf");
    expect(result).toEqual({ firstname: "Mary", surname: "Ann Evans", fullname: "Mary Ann Evans" });
  });

  it("returns null for single word", () => {
    expect(parseCVFileName("John.pdf")).toBeNull();
  });

  it("returns null for no filename", () => {
    expect(parseCVFileName(".pdf")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseCVFileName("")).toBeNull();
  });

  it("handles .PDF uppercase extension", () => {
    const result = parseCVFileName("John Smith.PDF");
    expect(result).toEqual({ firstname: "John", surname: "Smith", fullname: "John Smith" });
  });

  it("handles trailing whitespace", () => {
    const result = parseCVFileName("  John Smith.pdf  ");
    expect(result).toEqual({ firstname: "John", surname: "Smith", fullname: "John Smith" });
  });

  it("capitalises both names from any casing", () => {
    const result = parseCVFileName("JOHN DOE.pdf");
    expect(result).toEqual({ firstname: "John", surname: "Doe", fullname: "John Doe" });
  });

  it("parses CamelCase with lowercase first letter", () => {
    const result = parseCVFileName("johnMeyrick.pdf");
    expect(result).toEqual({ firstname: "John", surname: "Meyrick", fullname: "John Meyrick" });
  });

  it("parses PascalCase multi-word", () => {
    const result = parseCVFileName("JohnMichaelDoe.pdf");
    expect(result).toEqual({ firstname: "John", surname: "Michael Doe", fullname: "John Michael Doe" });
  });
});
