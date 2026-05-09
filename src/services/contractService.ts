import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable, type UploadTask } from "firebase/storage";
import { db, storage } from "./firebase";
import type { SignedContract, UnsignedContract } from "../types/domain";

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

export const uploadUnsignedContract = async (
  file: File,
  targetUserId: string,
  agencyId: string,
  uploadedByUid?: string,
  onProgress?: (pct: number) => void,
): Promise<void> => {
  const path = `contracts/unsigned/${targetUserId}/${file.name}`;
  const storageRef = ref(storage, path);
  const task = uploadBytesResumable(storageRef, file, { customMetadata: { agencyId } });
  await monitorUpload(task, onProgress);
  const fileUrl = await getDownloadURL(storageRef);

  await addDoc(collection(db, "unsigned_contracts"), {
    targetUserId,
    agencyId,
    fileName: file.name,
    fileUrl,
    uploadedByUid: uploadedByUid ?? null,
    status: "pending",
    createdAt: serverTimestamp(),
  });
};

export const uploadSignedContract = async (
  file: File,
  currentUserId: string,
  agencyId: string,
  unsignedContractId?: string,
  onProgress?: (pct: number) => void,
): Promise<void> => {
  const path = `contracts/signed/${currentUserId}/${file.name}`;
  const storageRef = ref(storage, path);
  const task = uploadBytesResumable(storageRef, file, { customMetadata: { agencyId } });
  await monitorUpload(task, onProgress);
  const fileUrl = await getDownloadURL(storageRef);

  await addDoc(collection(db, "signed_contracts"), {
    userId: currentUserId,
    agencyId,
    fileName: file.name,
    fileUrl,
    signedAt: serverTimestamp(),
  });

  if (unsignedContractId) {
    await updateDoc(doc(db, "unsigned_contracts", unsignedContractId), {
      status: "completed",
      completedAt: serverTimestamp(),
    });
  }
};

export const getPendingContracts = async (userId: string, agencyId: string): Promise<UnsignedContract[]> => {
  const q = query(
    collection(db, "unsigned_contracts"),
    where("targetUserId", "==", userId),
    where("agencyId", "==", agencyId),
    where("status", "==", "pending"),
    orderBy("createdAt", "desc"),
  );
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<UnsignedContract, "id">) }));
};

export const getContractsForUser = async (userId: string, agencyId: string): Promise<UnsignedContract[]> => {
  const q = query(
    collection(db, "unsigned_contracts"),
    where("targetUserId", "==", userId),
    where("agencyId", "==", agencyId),
    orderBy("createdAt", "desc"),
  );
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<UnsignedContract, "id">) }));
};

export const getSignedContractsForAdmin = async (agencyId: string): Promise<SignedContract[]> => {
  const q = query(
    collection(db, "signed_contracts"),
    where("agencyId", "==", agencyId),
    orderBy("signedAt", "desc"),
  );
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SignedContract, "id">) }));
};
