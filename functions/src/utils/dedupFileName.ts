import type { Bucket } from "@google-cloud/storage";

export async function dedupFileName(
  bucket: Bucket,
  prefix: string,
  fileName: string,
): Promise<{ uniqueName: string; filePath: string }> {
  const extIndex = fileName.lastIndexOf(".");
  const ext = extIndex >= 0 ? fileName.slice(extIndex) : "";
  const base = extIndex >= 0 ? fileName.slice(0, extIndex) : fileName;

  let uniqueName = fileName;
  let counter = 1;
  let filePath = `${prefix}/${uniqueName}`;
  let fileRef = bucket.file(filePath);
  while ((await fileRef.exists())[0]) {
    uniqueName = `${base}_${counter}${ext}`;
    filePath = `${prefix}/${uniqueName}`;
    fileRef = bucket.file(filePath);
    counter++;
  }

  return { uniqueName, filePath };
}
