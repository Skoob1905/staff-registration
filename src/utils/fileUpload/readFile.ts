/**
 * Reads a `File` and returns its contents as a base64-encoded string
 * (without the `data:*;base64,` prefix).
 *
 * @param file - The file to read.
 * @returns A promise that resolves with the base64-encoded file content.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
