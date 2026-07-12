import { parseCVFileName } from "./cvFileName";
import type { CvFile, BulkStaff } from "../types/domain";

export { type CvFile } from "../types/domain";

export const CV_FILE_SIZE_LIMIT = 2 * 1024 * 1024;

function findMatch(
  firstname: string,
  surname: string,
  staffList: BulkStaff[],
): BulkStaff | null {
  return (
    staffList.find(
      (s) =>
        s.Forename?.toLowerCase() === firstname.toLowerCase() &&
        s.Surname?.toLowerCase() === surname.toLowerCase(),
    ) ?? null
  );
}

export function readCvFile(
  file: File,
  staffList: BulkStaff[],
): Promise<CvFile> {
  return new Promise((resolve) => {
    const parsed = parseCVFileName(file.name);

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      resolve({
        file,
        base64: "",
        parsedForename: "",
        parsedSurname: "",
        match: null,
        error: "format",
      });
      return;
    }

    if (file.size > CV_FILE_SIZE_LIMIT) {
      resolve({
        file,
        base64: "",
        parsedForename: parsed?.firstname ?? "",
        parsedSurname: parsed?.surname ?? "",
        match: null,
        error: "size",
      });
      return;
    }

    if (!parsed) {
      resolve({
        file,
        base64: "",
        parsedForename: "",
        parsedSurname: "",
        match: null,
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve({
        file,
        base64: result.split(",")[1],
        parsedForename: parsed.firstname,
        parsedSurname: parsed.surname,
        match: findMatch(parsed.firstname, parsed.surname, staffList),
      });
    };
    reader.onerror = () => {
      resolve({
        file,
        base64: "",
        parsedForename: parsed.firstname,
        parsedSurname: parsed.surname,
        match: null,
      });
    };
    reader.readAsDataURL(file);
  });
}
