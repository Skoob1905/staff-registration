import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "./firebase";
import type { Payslip } from "../types/domain";

export const uploadPayslipToStaff = async (
  fileBase64: string,
  fileName: string,
  userId: string,
  agencyId: string,
): Promise<{ payslipId: string; url: string }> => {
  const callable = httpsCallable<
    { fileBase64: string; fileName: string; userId: string; agencyId: string },
    { ok: boolean; payslipId: string; url: string }
  >(functions, "uploadPayslipToStaff");
  const result = await callable({ fileBase64, fileName, userId, agencyId });
  return result.data;
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
  return uploadPayslipToStaff(fileBase64, file.name, userId, agencyId);
};

export const getPayslipsForUser = async (email: string): Promise<Payslip[]> => {
  const staffSnaps = await getDocs(
    query(collection(db, "staff"), where("Email", "==", email)),
  );

  if (staffSnaps.empty) return [];

  const payslipIds = (staffSnaps.docs[0].data().payslipsSent as string[]) ?? [];
  if (!payslipIds.length) return [];

  const payslipDocs = await Promise.all(
    payslipIds.map((id) => getDoc(doc(db, "payslips", id))),
  );

  return payslipDocs
    .filter((d) => d.exists())
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Payslip, "id">) }))
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
