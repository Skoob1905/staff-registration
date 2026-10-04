import { unzipSync } from "fflate";

/**
 * Returns true for macOS archive metadata entries — AppleDouble resource
 * forks (`._file.pdf`) and anything inside the `__MACOSX` folder — which
 * would otherwise be picked up as duplicates because they also end in `.pdf`.
 */
function isMacMetadata(path: string, baseName: string): boolean {
  return (
    path.startsWith("__MACOSX/") ||
    path.includes("/__MACOSX/") ||
    baseName.startsWith("._") ||
    baseName === ".DS_Store"
  );
}

/**
 * Extracts every `.pdf` entry from a `.zip` archive, flattening nested
 * folders to the file's base name. Directory entries, macOS metadata, and
 * non-PDF files are ignored.
 *
 * @param zipFile - The uploaded `.zip` file.
 * @returns The contained PDF files, in archive order.
 */
export async function extractPdfFilesFromZip(zipFile: File): Promise<File[]> {
  const bytes = new Uint8Array(await zipFile.arrayBuffer());
  const entries = unzipSync(bytes);
  const files: File[] = [];

  for (const path in entries) {
    const data = entries[path];
    if (!data || path.endsWith("/")) continue;

    const name = path.split("/").pop() ?? path;
    if (isMacMetadata(path, name)) continue;
    if (!name.toLowerCase().endsWith(".pdf")) continue;

    files.push(new File([data.slice()], name, { type: "application/pdf" }));
  }

  return files;
}
