import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getDownloadURL, ref, uploadBytesResumable, type UploadTask } from "firebase/storage";
import { db, functions, storage } from "./firebase";
import type { Payslip } from "../types/domain";
import { getUserProfile } from "./userService";

const monitorUpload = (task: UploadTask, onProgress?: (pct: number) => void): Promise<void> =>
  new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snapshot) => {
        if (!onProgress) return;
        const pct = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress(Math.round(pct));
      },
      reject,
      () => resolve(),
    );
  });

export const uploadPayslip = async (
  file: File,
  userId: string,
  agencyId: string,
  uploadedByUid?: string,
  onProgress?: (pct: number) => void,
): Promise<void> => {
  const path = `payslips/${agencyId}/${userId}/${file.name}`;
  const storageRef = ref(storage, path);
  const task = uploadBytesResumable(storageRef, file, { customMetadata: { agencyId } });
  await monitorUpload(task, onProgress);
  const fileUrl = await getDownloadURL(storageRef);
  const senderProfile = uploadedByUid ? await getUserProfile(uploadedByUid) : null;
  const sentBy = senderProfile?.email ?? "Unknown";

  const payslipRef = await addDoc(collection(db, "payslips"), {
    userId,
    agencyId,
    fileName: file.name,
    fileUrl,
    sentBy,
    timestamp: serverTimestamp(),
    hasDownloaded: false,
  });

  const userSnap = await getDoc(doc(db, "users", userId));
  const existing = (userSnap.data()?.payslipsSent as string[]) ?? [];
  await updateDoc(doc(db, "users", userId), {
    payslipsSent: [payslipRef.id, ...existing],
  });
};

export const getPayslipsForUser = async (userId: string, agencyId: string): Promise<Payslip[]> => {
  const q = query(
    collection(db, "payslips"),
    where("userId", "==", userId),
    where("agencyId", "==", agencyId),
  );
  const snaps = await getDocs(q);
  return snaps.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Payslip, "id">) }))
    .sort((a, b) => {
      const toMs = (ts: unknown) => (ts as { toDate: () => Date } | null)?.toDate?.()?.getTime() ?? 0;
      return toMs(b.timestamp) - toMs(a.timestamp);
    });
};

export const markPayslipDownloaded = async (payslipId: string): Promise<void> => {
  const callable = httpsCallable(functions, "updatePayslipDownloadedStatus");
  await callable({ payslipId });
};
