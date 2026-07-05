import {
  getUser,
  getUsersByAgencyAndRole,
  getUsersInvitedByAgency,
  getUserByEmailAndAgency,
  getUnregisteredStaffByAgency,
  getUnregisteredStaffByUid,
  getUnregisteredStaffByEmailAndAgency,
  getAgency,
} from "./firestore";
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
  const data = await getUser(uid, options);
  return data as AppUser | null;
};

export const getAgencyProfile = async (
  agencyId: string,
): Promise<Agency | null> => {
  const data = await getAgency(agencyId);
  if (!data) return null;
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
    id: agencyId,
    name,
    slug: (data.slug as string) || "",
    assignedStaff: (data.assignedStaff as string[]) || [],
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
  const [byAgencyId, byInvited] = await Promise.all([
    getUsersByAgencyAndRole(agencyId, "client"),
    getUsersInvitedByAgency(agencyId, "client"),
  ]);
  const seen = new Set<string>();
  const snaps = [...byAgencyId, ...byInvited].filter(
    (d) => !seen.has(d.uid as string) && !!seen.add(d.uid as string),
  );
  return snaps as unknown as AppUser[];
};

export const getAwaitingRegistrationsByAgency = async (
  agencyId: string,
): Promise<AwaitingRegistration[]> => {
  const docs = await getUnregisteredStaffByAgency(agencyId);
  return docs as unknown as AwaitingRegistration[];
};

export const getAwaitingRegistrationByUid = async (
  uid: string,
): Promise<AwaitingRegistration | null> => {
  const doc = await getUnregisteredStaffByUid(uid);
  return doc as unknown as AwaitingRegistration | null;
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
  const users = await getUserByEmailAndAgency(normalizedEmail, agencyId);

  if (users.length > 0) {
    const role = users[0].role as UserRole | undefined;
    return { exists: true, role: role || "client", state: "staff" };
  }

  const awaiting = await getUnregisteredStaffByEmailAndAgency(normalizedEmail, agencyId);
  if (awaiting.length > 0) {
    return { exists: true, role: "client", state: "awaiting" };
  }

  return { exists: false };
};
