export type UserRole = "admin" | "client" | "super" | "worker";

export interface AppUser {
  uid: string;
  email: string;
  role: UserRole;
  agencyId: string;
  assignedToId?: string;
  registrationStatus?: "awaiting" | "registered";
  loginStatus?: "awaiting_login" | "password_set" | "logged_in";
  contractSigned?: boolean;
  contractSignedAt?: Date;
  contractSent?: Date;
  contractSentBy?: string;
  firstName?: string;
  lastName?: string;
  birthday?: string;
  address?: string;
  registeredAt?: Date;
  lastLoginTime?: Date | null;
  payslipsSent?: string[];
}

export interface Agency {
  id: string;
  name: string;
  slug: string;
  assignedStaff: string[];
}

export interface UnsignedContract {
  id: string;
  targetUserId: string;
  targetUserName?: string;
  fileName: string;
  fileUrl: string;
  agencyId: string;
  uploadedByUid?: string;
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

export interface ClientContract {
  id: string;
  clientId: string;
  fileName: string;
  fileUrl: string;
  agencyId: string;
  uploadedBy: string;
  uploadedAt?: Date;
}

export interface Payslip {
  id: string;
  userId: string;
  fileName: string;
  fileUrl: string;
  agencyId: string;
  sentBy?: string;
  timestamp?: Date;
  hasDownloaded?: boolean;
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

export interface StaffType {
  id: string;
  name: string;
}

export interface StaffTag {
  id: string;
  value: string;
}

export interface FilterKeyMap {
  tag: string;
  agency: string;
}

export interface StaffFilters {
  name: string;
  typeIds: string[];
  agencyIds: string[];
  tagIds: string[];
}

export const emptyFilters: StaffFilters = {
  name: "",
  typeIds: [],
  agencyIds: [],
  tagIds: [],
};

export interface StaffCvEntry {
  fileName: string;
  fileUrl: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface UploadableFile {
  file: File;
  base64: string;
  error?: "size" | "format";
}

export interface CvFile extends UploadableFile {
  parsedForename: string;
  parsedSurname: string;
  match: BulkStaff | null;
}

export interface PayslipFile extends UploadableFile {
  parsedFirstname: string;
  parsedLastname: string;
  workerRef: string;
  status: "missing" | "wrong info" | "matched";
  email?: string;
  agencyId?: string;
}

export interface BulkStaff {
  id: string;
  email: string;
  Title: string;
  Initial: string;
  Forename: string;
  Surname: string;
  FullName?: string;
  address1: string;
  address2: string;
  agencyId: string;
  assignedBy: string;
  assignedAt?: Date;
  sourceFileName: string;
  loginStatus?: string;
  typeIds?: string[];
  tags?: string[];
  metadata?: {
    assignedTo?: string;
    assignedToId?: string;
    assignedToName?: string;
    assignedBy?: string;
    assignedAt?: Date;
    uploadedInFile?: string;
    uploadedBy?: string;
    importedAt?: Date;
    cv?: StaffCvEntry[];
  };
}

export interface BulkUploadRecord {
  id: string;
  fileName: string;
  fileStoragePath: string;
  uploadedBy: string;
  uploadedAt?: Date;
  agencyId: string;
  totalRows: number;
  addedCount: number;
  skippedCount: number;
}

export interface AwaitingRegistration {
  id: string;
  uid: string;
  email: string;
  agencyId: string;
  invitedByAgencyId?: string;
  invitedByUid: string;
  status: "awaiting";
  invitedAt?: Date;
}

export interface Login {
  id: string;
  email: string;
  agencyDocId: string;
  agencyId: string;
  uploadedBy: string;
  createdAt: Date;
}
