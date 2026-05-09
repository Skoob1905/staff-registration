import { addDoc, collection, getDocs, orderBy, query, serverTimestamp, where } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable, type UploadTask } from "firebase/storage";
import { db, storage } from "./firebase";
import type { StaffUpload } from "../types/domain";

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

export const uploadStaffDocument = async (
  file: File,
  userId: string,
  agencyId: string,
  category = "general",
  onProgress?: (pct: number) => void,
): Promise<void> => {
  const path = `uploads/from_staff/${userId}/${file.name}`;
  const storageRef = ref(storage, path);
  const task = uploadBytesResumable(storageRef, file, { customMetadata: { agencyId } });
  await monitorUpload(task, onProgress);
  const fileUrl = await getDownloadURL(storageRef);

  await addDoc(collection(db, "staff_uploads"), {
    userId,
    agencyId,
    fileName: file.name,
    fileUrl,
    category,
    uploadedAt: serverTimestamp(),
  });
};

export const getStaffUploadsForAgency = async (agencyId: string): Promise<StaffUpload[]> => {
  const q = query(collection(db, "staff_uploads"), where("agencyId", "==", agencyId), orderBy("uploadedAt", "desc"));
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StaffUpload, "id">) }));
};
