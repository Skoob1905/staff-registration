import {
  collection,
  addDoc, getDocs,
  query,
  serverTimestamp,
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
  targetUserName?: string,
  onProgress?: (pct: number) => void,
): Promise<void> => {
  const path = `contracts/unsigned/${targetUserId}/${file.name}`;
  const storageRef = ref(storage, path);
  const task = uploadBytesResumable(storageRef, file, { customMetadata: { agencyId, targetUserId, targetUserName: targetUserName ?? "" } });
  await monitorUpload(task, onProgress);
  const fileUrl = await getDownloadURL(storageRef);

  await addDoc(collection(db, "unsigned_contracts"), {
    targetUserId,
    agencyId,
    fileName: file.name,
    fileUrl,
    uploadedByUid: uploadedByUid ?? null,
    targetUserName: targetUserName ?? null,
    status: "pending",
    createdAt: serverTimestamp(),
  });
};

export const uploadSignedContract = async (
  file: File,
  currentUserId: string,
  agencyId: string,
  onProgress?: (pct: number) => void,
): Promise<{ fileName: string; fileUrl: string }> => {
  const path = `contracts/signed/${currentUserId}/${file.name}`;
  const storageRef = ref(storage, path);
  const task = uploadBytesResumable(storageRef, file, { customMetadata: { agencyId } });
  await monitorUpload(task, onProgress);
  const fileUrl = await getDownloadURL(storageRef);
  return { fileName: file.name, fileUrl };
};

export const getUnsignedContractInfo = async (userId: string, agencyId: string): Promise<UnsignedContract[]> => {
  const q = query(
    collection(db, "unsigned_contracts"),
    where("targetUserId", "==", userId),
    where("agencyId", "==", agencyId),
    where("status", "==", "pending"),
  );
  const snaps = await getDocs(q);
  return snaps.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<UnsignedContract, "id">) }))
    .sort((a, b) => {
      const aMs = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
      const bMs = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
      return bMs - aMs;
    });
};

export const getPendingContracts = async (userId: string, agencyId: string): Promise<UnsignedContract[]> => {
  const q = query(
    collection(db, "unsigned_contracts"),
    where("targetUserId", "==", userId),
    where("agencyId", "==", agencyId),
    where("status", "==", "pending"),
  );
  const snaps = await getDocs(q);
  return snaps.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<UnsignedContract, "id">) }))
    .sort((a, b) => {
      const aMs = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
      const bMs = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
      return bMs - aMs;
    });
};

export const getLatestUnsignedContract = async (
  userId: string,
  agencyId: string,
): Promise<UnsignedContract | null> => {
  const pending = await getPendingContracts(userId, agencyId);
  return pending[0] ?? null;
};

export const getContractsForUser = async (userId: string, agencyId: string): Promise<UnsignedContract[]> => {
  const q = query(
    collection(db, "unsigned_contracts"),
    where("targetUserId", "==", userId),
    where("agencyId", "==", agencyId),
  );
  const snaps = await getDocs(q);
  return snaps.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<UnsignedContract, "id">) }))
    .sort((a, b) => {
      const aMs = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
      const bMs = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
      return bMs - aMs;
    });
};

export const getSignedContractsForAdmin = async (agencyId: string): Promise<SignedContract[]> => {
  const q = query(
    collection(db, "signed_contracts"),
    where("agencyId", "==", agencyId),
  );
  const snaps = await getDocs(q);
  return snaps.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<SignedContract, "id">) }))
    .sort((a, b) => {
      const aMs = a.signedAt instanceof Date ? a.signedAt.getTime() : 0;
      const bMs = b.signedAt instanceof Date ? b.signedAt.getTime() : 0;
      return bMs - aMs;
    });
};

export const getSignedContractsForUser = async (
  userId: string,
  agencyId: string,
): Promise<SignedContract[]> => {
  const q = query(
    collection(db, "signed_contracts"),
    where("userId", "==", userId),
    where("agencyId", "==", agencyId),
  );
  const snaps = await getDocs(q);
  return snaps.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<SignedContract, "id">) }))
    .sort((a, b) => {
      const aMs = a.signedAt instanceof Date ? a.signedAt.getTime() : 0;
      const bMs = b.signedAt instanceof Date ? b.signedAt.getTime() : 0;
      return bMs - aMs;
    });
};
