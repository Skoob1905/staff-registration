import {
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  collection,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  getCountFromServer,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

export { serverTimestamp };

// ── Users ──

export async function getUser(
  uid: string,
  opts?: { fromServer?: boolean },
): Promise<Record<string, unknown> | null> {
  const ref = doc(db, "users", uid);
  const snap = opts?.fromServer ? await getDocFromServer(ref) : await getDoc(ref);
  return snap.exists() ? { uid: snap.id, ...snap.data() } : null;
}

export async function getUsersByAgencyAndRole(
  agencyId: string,
  role: string,
): Promise<Record<string, unknown>[]> {
  const q = query(
    collection(db, "users"),
    where("agencyId", "==", agencyId),
    where("role", "==", role),
  );
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

export async function getUsersInvitedByAgency(
  agencyId: string,
  role: string,
): Promise<Record<string, unknown>[]> {
  const q = query(
    collection(db, "users"),
    where("invitedByAgencyId", "==", agencyId),
    where("role", "==", role),
  );
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

export async function getUserByEmailAndAgency(
  email: string,
  agencyId: string,
): Promise<Record<string, unknown>[]> {
  const q = query(
    collection(db, "users"),
    where("email", "==", email),
    where("agencyId", "==", agencyId),
  );
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

// ── Agencies ──

export async function getAgency(id: string): Promise<Record<string, unknown> | null> {
  const snap = await getDoc(doc(db, "agencies", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getAllAgencies(): Promise<Record<string, unknown>[]> {
  const snaps = await getDocs(collection(db, "agencies"));
  return snaps.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getAgenciesByImportingAgency(
  agencyId: string,
): Promise<Record<string, unknown>[]> {
  const q = query(
    collection(db, "agencies"),
    where("importedByAgencyId", "==", agencyId),
  );
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ── Staff ──

export async function getStaff(id: string): Promise<Record<string, unknown> | null> {
  const snap = await getDoc(doc(db, "staff", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getStaffByEmail(email: string): Promise<Record<string, unknown>[]> {
  const q = query(
    collection(db, "staff"),
    where("email", "==", email.toLowerCase()),
  );
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getAllStaff(): Promise<Record<string, unknown>[]> {
  const snaps = await getDocs(collection(db, "staff"));
  return snaps.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getStaffByAgency(agencyId: string): Promise<Record<string, unknown>[]> {
  const q = query(
    collection(db, "staff"),
    where("agencyId", "==", agencyId),
    orderBy("assignedAt", "desc"),
  );
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addStaffTags(staffId: string, tags: string[]): Promise<void> {
  await updateDoc(doc(db, "staff", staffId), { tags: arrayUnion(...tags) });
}

export async function removeStaffTags(staffId: string, tags: string[]): Promise<void> {
  await updateDoc(doc(db, "staff", staffId), { tags: arrayRemove(...tags) });
}

// ── Clients ──

export async function getClientByEmail(email: string): Promise<Record<string, unknown> | null> {
  const q = query(
    collection(db, "clients"),
    where("email", "==", email.toLowerCase()),
    limit(1),
  );
  const snaps = await getDocs(q);
  return snaps.empty ? null : { id: snaps.docs[0].id, ...snaps.docs[0].data() };
}

// ── Contracts ──

export async function getUnsignedContractsByUser(
  userId: string,
  agencyId: string,
  status?: string,
): Promise<Record<string, unknown>[]> {
  const constraints: any[] = [
    where("targetUserId", "==", userId),
    where("agencyId", "==", agencyId),
  ];
  if (status) {
    constraints.push(where("status", "==", status));
  }
  const q = query(collection(db, "unsigned_contracts"), ...constraints);
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getSignedContractsByAgency(
  agencyId: string,
): Promise<Record<string, unknown>[]> {
  const q = query(
    collection(db, "signed_contracts"),
    where("agencyId", "==", agencyId),
  );
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getSignedContractsByUser(
  userId: string,
  agencyId: string,
): Promise<Record<string, unknown>[]> {
  const q = query(
    collection(db, "signed_contracts"),
    where("userId", "==", userId),
    where("agencyId", "==", agencyId),
  );
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createUnsignedContract(
  data: Record<string, unknown>,
): Promise<string> {
  const ref = await addDoc(collection(db, "unsigned_contracts"), data);
  return ref.id;
}

// ── Payslips ──

export async function getPayslip(id: string): Promise<Record<string, unknown> | null> {
  const snap = await getDoc(doc(db, "payslips", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ── Tags ──

export async function getAllTags(): Promise<Record<string, unknown>[]> {
  const snaps = await getDocs(collection(db, "tags"));
  return snaps.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ── Unregistered Staff ──

export async function getUnregisteredStaffByUid(
  uid: string,
): Promise<Record<string, unknown> | null> {
  const snap = await getDocFromServer(doc(db, "unregistered_staff", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getUnregisteredStaffByAgency(
  agencyId: string,
): Promise<Record<string, unknown>[]> {
  const q = query(
    collection(db, "unregistered_staff"),
    where("agencyId", "==", agencyId),
  );
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getUnregisteredStaffByEmailAndAgency(
  email: string,
  agencyId: string,
): Promise<Record<string, unknown>[]> {
  const q = query(
    collection(db, "unregistered_staff"),
    where("email", "==", email),
    where("agencyId", "==", agencyId),
  );
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ── Staff Uploads ──

export async function getStaffUploadsByAgency(
  agencyId: string,
): Promise<Record<string, unknown>[]> {
  const q = query(
    collection(db, "staff_uploads"),
    where("agencyId", "==", agencyId),
    orderBy("uploadedAt", "desc"),
  );
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createStaffUpload(
  data: Record<string, unknown>,
): Promise<string> {
  const ref = await addDoc(collection(db, "staff_uploads"), data);
  return ref.id;
}

// ── Upload History ──

export async function getAllUploadHistory(): Promise<Record<string, unknown>[]> {
  const q = query(collection(db, "uploads"), orderBy("uploadedAt", "desc"));
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ── CSV Imports ──

export async function getImportHistory(
  type?: string,
): Promise<Record<string, unknown>[]> {
  const constraints: any[] = [];
  if (type) {
    constraints.push(where("type", "==", type));
  }
  const q = query(collection(db, "csv_imports"), ...constraints);
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ── Count ──

export async function countCollection(collectionName: string): Promise<number> {
  const snap = await getCountFromServer(collection(db, collectionName));
  return snap.data().count;
}
