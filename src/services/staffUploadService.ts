import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import {
  getDownloadURL,
  ref,
  uploadBytesResumable,
  type UploadTask,
} from "firebase/storage";
import { db, storage } from "./firebase";
import type {
  Agency,
  BulkStaff,
  BulkUploadRecord,
  StaffUpload,
} from "../types/domain";

const monitorUpload = (
  task: UploadTask,
  onProgress?: (pct: number) => void,
): Promise<void> =>
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
  const task = uploadBytesResumable(storageRef, file, {
    customMetadata: { agencyId },
  });
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

export const getStaffUploadsForAgency = async (
  agencyId: string,
): Promise<StaffUpload[]> => {
  const q = query(
    collection(db, "staff_uploads"),
    where("agencyId", "==", agencyId),
    orderBy("uploadedAt", "desc"),
  );
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<StaffUpload, "id">),
  }));
};

export const getAllAgencies = async (): Promise<Agency[]> => {
  const snaps = await getDocs(collection(db, "agencies"));
  return snaps.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<Agency, "id">),
  }));
};

export interface CsvStaffRow {
  email: string;
  title: string;
  initial: string;
  forename: string;
  surname: string;
  fullName?: string;
  address1: string;
  address2: string;
}

const normalizeKey = (key: string): string =>
  key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

const findNormalizedIndex = (
  normalizedHeaders: string[],
  ...targets: string[]
): number => {
  for (const target of targets) {
    const nt = normalizeKey(target);
    const idx = normalizedHeaders.indexOf(nt);
    if (idx !== -1) return idx;
  }
  return -1;
};

export const parseCsvText = (
  text: string,
): { headers: string[]; rows: CsvStaffRow[]; errors: string[] } => {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const errors: string[] = [];
  const rows: CsvStaffRow[] = [];

  if (lines.length < 2) {
    return {
      headers: [],
      rows,
      errors: ["CSV must have a header row and at least one data row."],
    };
  }

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const normalizedHeaders = headers.map(normalizeKey);

  const emailIdx = headers.indexOf("email");
  const titleIdx = findNormalizedIndex(normalizedHeaders, "title");
  const initialIdx = headers.indexOf("initial");
  const forenameIdx = findNormalizedIndex(
    normalizedHeaders,
    "forename",
    "firstname",
  );
  const surnameIdx = findNormalizedIndex(
    normalizedHeaders,
    "surname",
    "lastname",
  );
  const fullNameIdx = findNormalizedIndex(normalizedHeaders, "fullname");
  const address1Idx = headers.indexOf("address 1");
  const address2Idx = headers.indexOf("address 2");

  if (emailIdx === -1) {
    return { headers, rows, errors: ["CSV must contain an 'Email' column."] };
  }

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const email = cols[emailIdx]?.toLowerCase() ?? "";
    if (!email) {
      errors.push(`Row ${i + 1}: missing email, skipped.`);
      continue;
    }

    let forename = cols[forenameIdx] ?? "";
    let surname = cols[surnameIdx] ?? "";
    const fullName = cols[fullNameIdx] ?? "";

    if (!forename && !surname && fullName) {
      const trimmed = fullName.trim();
      const firstSpace = trimmed.indexOf(" ");
      if (firstSpace > 0) {
        forename = trimmed.slice(0, firstSpace).trim();
        surname = trimmed.slice(firstSpace + 1).trim();
      } else {
        forename = trimmed;
      }
    }

    rows.push({
      email,
      title: cols[titleIdx] ?? "",
      initial: cols[initialIdx] ?? "",
      forename,
      surname,
      fullName: fullName || undefined,
      address1: cols[address1Idx] ?? "",
      address2: cols[address2Idx] ?? "",
    });
  }

  return { headers, rows, errors };
};

export const uploadCsvToStorage = async (
  file: File,
  agencyId: string,
  onProgress?: (pct: number) => void,
): Promise<{ storagePath: string; downloadUrl: string }> => {
  const storagePath = `bulk-uploads/${agencyId}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, storagePath);
  const task = uploadBytesResumable(storageRef, file, {
    customMetadata: { agencyId },
  });
  await monitorUpload(task, onProgress);
  const downloadUrl = await getDownloadURL(storageRef);
  return { storagePath, downloadUrl };
};

export const getBulkStaffForAgency = async (
  agencyId: string,
): Promise<BulkStaff[]> => {
  const q = query(
    collection(db, "staff"),
    where("agencyId", "==", agencyId),
    orderBy("assignedAt", "desc"),
  );
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<BulkStaff, "id">),
  }));
};

export const getUploadHistory = async (): Promise<BulkUploadRecord[]> => {
  const q = query(collection(db, "uploads"), orderBy("uploadedAt", "desc"));
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<BulkUploadRecord, "id">),
  }));
};
