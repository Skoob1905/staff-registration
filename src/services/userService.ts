import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase";
import type { Agency, AppUser, UserRole } from "../types/domain";

export const getUserProfile = async (uid: string): Promise<AppUser | null> => {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) {
    return null;
  }
  const data = snap.data() as Omit<AppUser, "uid">;
  return { uid: snap.id, ...data };
};

export const getAgencyProfile = async (agencyId: string): Promise<Agency | null> => {
  const snap = await getDoc(doc(db, "agencies", agencyId));
  if (!snap.exists()) {
    return null;
  }
  const data = snap.data() as Omit<Agency, "id">;
  return { id: snap.id, ...data };
};

export const getUserRole = async (uid: string): Promise<UserRole | null> => {
  const profile = await getUserProfile(uid);
  return profile?.role ?? null;
};

export const isAdminUser = async (uid: string): Promise<boolean> => {
  const role = await getUserRole(uid);
  return role === "admin";
};

export const getStaffUsersByAgency = async (agencyId: string): Promise<AppUser[]> => {
  const usersRef = collection(db, "users");
  const q = query(usersRef, where("agencyId", "==", agencyId), where("role", "==", "user"));
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<AppUser, "uid">) }));
};

export const checkEmailStatus = async (
  email: string,
  agencyId: string,
): Promise<{ exists: boolean; role?: UserRole }> => {
  const normalizedEmail = email.trim().toLowerCase();
  const usersRef = collection(db, "users");
  const q = query(
    usersRef,
    where("email", "==", normalizedEmail),
    where("agencyId", "==", agencyId),
  );
  const snaps = await getDocs(q);

  if (snaps.empty) {
    return { exists: false };
  }

  const role = snaps.docs[0].data().role as UserRole | undefined;
  return { exists: true, role: role === "admin" ? "admin" : "user" };
};
