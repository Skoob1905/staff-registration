import { describe, it, expect } from "vitest";
import { strToU8, zipSync } from "fflate";
import { extractPdfFilesFromZip } from "../extractPayslipsFromZip";

const makeZip = (entries: Record<string, string>) => {
  const data: Record<string, Uint8Array> = {};
  for (const [name, content] of Object.entries(entries)) {
    data[name] = strToU8(content);
  }
  return new File([zipSync(data)], "payslips.zip");
};

describe("extractPdfFilesFromZip", () => {
  it("extracts every pdf entry", async () => {
    const zip = makeZip({
      "Payslip Week 1.pdf": "a",
      "Payslip Week 2.pdf": "b",
    });
    const files = await extractPdfFilesFromZip(zip);
    expect(files.map((f) => f.name).sort()).toEqual([
      "Payslip Week 1.pdf",
      "Payslip Week 2.pdf",
    ]);
  });

  it("flattens nested folders to the base name", async () => {
    const zip = makeZip({
      "folder/Payslip Week 1.pdf": "a",
      "folder/": "",
    });
    const files = await extractPdfFilesFromZip(zip);
    expect(files.map((f) => f.name)).toEqual(["Payslip Week 1.pdf"]);
  });

  it("ignores non-pdf files", async () => {
    const zip = makeZip({
      "notes.txt": "x",
      "Payslip Week 1.pdf": "a",
      "image.png": "y",
    });
    const files = await extractPdfFilesFromZip(zip);
    expect(files.map((f) => f.name)).toEqual(["Payslip Week 1.pdf"]);
  });

  it("ignores macOS metadata entries (__MACOSX and ._ resource forks)", async () => {
    const zip = makeZip({
      "Payslip Week 1.pdf": "a",
      "__MACOSX/._Payslip Week 1.pdf": "meta",
      "._Payslip Week 1.pdf": "meta",
      ".DS_Store": "meta",
    });
    const files = await extractPdfFilesFromZip(zip);
    expect(files.map((f) => f.name)).toEqual(["Payslip Week 1.pdf"]);
  });

  it("returns an empty array when there are no pdfs", async () => {
    const zip = makeZip({ "readme.txt": "nothing here" });
    expect(await extractPdfFilesFromZip(zip)).toEqual([]);
  });
});
