import { addDoc, collection, getDocs, orderBy, query, serverTimestamp, where } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable, type UploadTask } from "firebase/storage";
import { db, storage } from "./firebase";
import type { Payslip } from "../types/domain";

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
  periodLabel: string,
  onProgress?: (pct: number) => void,
): Promise<void> => {
  const path = `payslips/${userId}/${file.name}`;
  const storageRef = ref(storage, path);
  const task = uploadBytesResumable(storageRef, file, { customMetadata: { agencyId } });
  await monitorUpload(task, onProgress);
  const fileUrl = await getDownloadURL(storageRef);

  await addDoc(collection(db, "payslips"), {
    userId,
    agencyId,
    fileName: file.name,
    fileUrl,
    periodLabel,
    uploadedAt: serverTimestamp(),
  });
};

export const getPayslipsForUser = async (userId: string, agencyId: string): Promise<Payslip[]> => {
  const q = query(
    collection(db, "payslips"),
    where("userId", "==", userId),
    where("agencyId", "==", agencyId),
    orderBy("uploadedAt", "desc"),
  );
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Payslip, "id">) }));
};
