export type UserRole = "admin" | "user";

export interface AppUser {
  uid: string;
  email: string;
  role: UserRole;
  agencyId: string;
}

export interface Agency {
  id: string;
  name: string;
  slug: string;
}

export interface UnsignedContract {
  id: string;
  targetUserId: string;
  fileName: string;
  fileUrl: string;
  agencyId: string;
  status: "pending" | "completed";
  createdAt?: Date;
  completedAt?: Date;
}

export interface SignedContract {
  id: string;
  userId: string;
  fileName: string;
  fileUrl: string;
  agencyId: string;
  signedAt?: Date;
}

export interface Payslip {
  id: string;
  userId: string;
  fileName: string;
  fileUrl: string;
  periodLabel: string;
  agencyId: string;
  uploadedAt?: Date;
}

export interface StaffUpload {
  id: string;
  userId: string;
  fileName: string;
  fileUrl: string;
  agencyId: string;
  category?: string;
  uploadedAt?: Date;
}

export interface AwaitingRegistration {
  id: string;
  uid: string;
  email: string;
  agencyId: string;
  invitedByUid: string;
  status: "awaiting";
  invitedAt?: Date;
}
