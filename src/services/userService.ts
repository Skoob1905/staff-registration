import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  Agency,
  AppUser,
  AwaitingRegistration,
  UserRole,
} from "../types/domain";
import { findValueByNormalizedKey } from "../utils/keyHeaderNormalisation";

export const getUserProfile = async (
  uid: string,
  options?: { fromServer?: boolean },
): Promise<AppUser | null> => {
  const ref = doc(db, "users", uid);
  const snap = options?.fromServer
    ? await getDocFromServer(ref)
    : await getDoc(ref);
  if (!snap.exists()) {
    return null;
  }
  const data = snap.data() as Omit<AppUser, "uid">;
  return { uid: snap.id, ...data };
};

export const getAgencyProfile = async (
  agencyId: string,
): Promise<Agency | null> => {
  const snap = await getDoc(doc(db, "agencies", agencyId));
  if (!snap.exists()) {
    return null;
  }
  const data = snap.data();
  const name: string =
    data.business_name ||
    data.Company_Name ||
    data.company_name ||
    data.name ||
    data.agencyName ||
    findValueByNormalizedKey(
      data,
      "businessname",
      "name",
      "agencyname",
      "organisation",
      "company",
    ) ||
    "Unknown";
  return {
    id: snap.id,
    name,
    slug: data.slug || "",
    assignedStaff: data.assignedStaff || [],
  };
};

export const getUserRole = async (uid: string): Promise<UserRole | null> => {
  const profile = await getUserProfile(uid);
  return profile?.role ?? null;
};

export const isAdminUser = async (uid: string): Promise<boolean> => {
  const role = await getUserRole(uid);
  return role === "admin";
};

export const getStaffUsersByAgency = async (
  agencyId: string,
): Promise<AppUser[]> => {
  const usersRef = collection(db, "users");
  const [byAgencyId, byInvited] = await Promise.all([
    getDocs(
      query(
        usersRef,
        where("agencyId", "==", agencyId),
        where("role", "==", "client"),
      ),
    ),
    getDocs(
      query(
        usersRef,
        where("invitedByAgencyId", "==", agencyId),
        where("role", "==", "client"),
      ),
    ),
  ]);
  const seen = new Set<string>();
  const snaps = [...byAgencyId.docs, ...byInvited.docs].filter(
    (d) => !seen.has(d.id) && !!seen.add(d.id),
  );
  return snaps.map((d) => ({
    uid: d.id,
    ...(d.data() as Omit<AppUser, "uid">),
  }));
};

export const getAwaitingRegistrationsByAgency = async (
  agencyId: string,
): Promise<AwaitingRegistration[]> => {
  const ref = collection(db, "unregistered_staff");
  const q = query(ref, where("agencyId", "==", agencyId));
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<AwaitingRegistration, "id">),
  }));
};

export const getAwaitingRegistrationByUid = async (
  uid: string,
): Promise<AwaitingRegistration | null> => {
  const snap = await getDocFromServer(doc(db, "unregistered_staff", uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<AwaitingRegistration, "id">) };
};

export const getStatus = async (
  uid: string,
): Promise<"awaiting" | "registered"> => {
  try {
    const profile = await getUserProfile(uid, { fromServer: true });
    if (!profile) {
      return "awaiting";
    }

    if (profile.registrationStatus === "awaiting") {
      return "awaiting";
    }

    // For existing registered profiles, no need to read unregistered_staff.
    return "registered";
  } catch (error) {
    console.error("getStatus failed", { uid, error });
    return "registered";
  }
};

export const checkEmailStatus = async (
  email: string,
  agencyId: string,
): Promise<{
  exists: boolean;
  role?: UserRole;
  state?: "staff" | "awaiting";
}> => {
  const normalizedEmail = email.trim().toLowerCase();
  const usersQuery = query(
    collection(db, "users"),
    where("email", "==", normalizedEmail),
    where("agencyId", "==", agencyId),
  );
  const usersSnaps = await getDocs(usersQuery);

  if (!usersSnaps.empty) {
    const role = usersSnaps.docs[0].data().role as UserRole | undefined;
    return {
      exists: true,
      role: role || "client",
      state: "staff",
    };
  }

  const awaitingQuery = query(
    collection(db, "unregistered_staff"),
    where("email", "==", normalizedEmail),
    where("agencyId", "==", agencyId),
  );
  const awaitingSnaps = await getDocs(awaitingQuery);
  if (!awaitingSnaps.empty) {
    return { exists: true, role: "client", state: "awaiting" };
  }

  return { exists: false };
};
