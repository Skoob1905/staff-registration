import type { Timestamp, FieldValue } from "firebase-admin/firestore";

export interface PasswordResetDoc {
  uid: string;
  email: string;
  expiresAt: Timestamp;
  createdAt: FieldValue;
}
