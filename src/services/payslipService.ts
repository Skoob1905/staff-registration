import { httpsCallable } from "firebase/functions";
import { getStaffByEmail, getPayslip } from "./firestore";
import { functions } from "./firebase";
import { editFileName } from "../utils/fileUpload/editFileName";
import { chunkByBase64Size } from "../utils/chunkByBase64Size";
import type { Payslip } from "../types/domain";

export const callUploadPayslip = async (
  fileBase64: string,
  fileName: string,
  userId: string,
  agencyId: string,
): Promise<{ payslipId: string; url: string }> => {
  const callable = httpsCallable<
    { fileBase64: string; fileName: string; userId: string; agencyId: string },
    { ok: boolean; payslipId: string; url: string }
  >(functions, "uploadPayslip");
  const result = await callable({ fileBase64, fileName, userId, agencyId });
  return result.data;
};

interface BulkEntry {
  fileBase64: string;
  fileName: string;
  userId: string;
  agencyId: string;
}

interface BulkResult {
  fileName: string;
  success: boolean;
  duplicate?: boolean;
  error?: string;
}

export interface BulkUploadProgress {
  currentBatch: number;
  completedBatches: number;
  totalBatches: number;
  uploaded: number;
  total: number;
}

const PAYSLIP_BATCH_SIZE = 50;

export const callBulkUploadPayslips = async (
  entries: BulkEntry[],
  onProgress?: (progress: BulkUploadProgress) => void,
): Promise<{ results: BulkResult[]; queued: number }> => {
  const callable = httpsCallable<
    { payslips: BulkEntry[] },
    { ok: boolean; results: BulkResult[]; queued: number }
  >(functions, "bulkUploadPayslips");

  const batches = chunkByBase64Size(entries, undefined, PAYSLIP_BATCH_SIZE);
  const results: BulkResult[] = [];
  let queued = 0;

  for (let i = 0; i < batches.length; i++) {
    onProgress?.({
      currentBatch: i + 1,
      completedBatches: i,
      totalBatches: batches.length,
      uploaded: results.length,
      total: entries.length,
    });

    const result = await callable({ payslips: batches[i] });
    results.push(...result.data.results);
    queued += result.data.queued ?? 0;

    onProgress?.({
      currentBatch: i + 1,
      completedBatches: i + 1,
      totalBatches: batches.length,
      uploaded: results.length,
      total: entries.length,
    });
  }

  return { results, queued };
};

const blobToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export const uploadPayslip = async (
  file: File,
  userId: string,
  agencyId: string,
): Promise<{ payslipId: string; url: string }> => {
  const fileBase64 = await blobToBase64(file);
  return callUploadPayslip(fileBase64, editFileName(file.name), userId, agencyId);
};

export const getPayslipsForUser = async (email: string): Promise<Payslip[]> => {
  const staffRecords = await getStaffByEmail(email);

  if (staffRecords.length === 0) return [];

  const data = staffRecords[0] as {
    metadata?: { payslipsSent?: string[] };
  };
  const payslipIds = data?.metadata?.payslipsSent ?? [];
  if (!payslipIds.length) return [];

  const payslipDocs = await Promise.all(payslipIds.map((id) => getPayslip(id)));

  return payslipDocs
    .filter((d): d is Record<string, unknown> => d !== null)
    .map((d) => ({ id: d.id as string, ...d }) as Payslip)
    .sort((a, b) => {
      const toMs = (ts: unknown) =>
        (ts as { toDate: () => Date } | null)?.toDate?.()?.getTime() ?? 0;
      return toMs(b.timestamp) - toMs(a.timestamp);
    });
};

export const markPayslipDownloaded = async (
  payslipId: string,
): Promise<void> => {
  const callable = httpsCallable(functions, "updatePayslipDownloadedStatus");
  await callable({ payslipId });
};
