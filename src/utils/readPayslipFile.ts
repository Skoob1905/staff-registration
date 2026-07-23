import { parseFileName } from "./fileUpload/parseFileName";
import { match } from "./fileUpload/match";
import { fileToBase64 } from "./fileUpload/readFile";
import type { PayslipFile } from "../types/domain";

export { type PayslipFile } from "../types/domain";

export const PAYSLIP_FILE_SIZE_LIMIT = 2 * 1024 * 1024;

export async function readPayslipFile(file: File): Promise<PayslipFile> {
  const parsed = parseFileName(file.name, "payslip");

  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return {
      file,
      base64: "",
      parsedFirstname: "",
      parsedLastname: "",
      workerRef: "",
      status: "missing",
      error: "format",
    };
  }

  if (file.size > PAYSLIP_FILE_SIZE_LIMIT) {
    return {
      file,
      base64: "",
      parsedFirstname: parsed?.firstname ?? "",
      parsedLastname: parsed?.lastname ?? "",
      workerRef: parsed?.workerRef ?? "",
      status: "missing",
      error: "size",
    };
  }

  if (!parsed) {
    return {
      file,
      base64: "",
      parsedFirstname: "",
      parsedLastname: "",
      workerRef: "",
      status: "missing",
    };
  }

  try {
    const base64 = await fileToBase64(file);
    const matched = await match(
      parsed.firstname,
      parsed.lastname,
      parsed.workerRef,
    );
    return {
      file,
      base64,
      parsedFirstname: parsed.firstname,
      parsedLastname: parsed.lastname,
      workerRef: matched.workerRef ?? parsed.workerRef,
      status: matched.status,
      email: matched.email,
      agencyId: matched.agencyId,
      loginStatus: matched.loginStatus,
    };
  } catch {
    return {
      file,
      base64: "",
      parsedFirstname: parsed.firstname,
      parsedLastname: parsed.lastname,
      workerRef: parsed.workerRef,
      status: "missing",
    };
  }
}
