import type { Timestamp } from "firebase-admin/firestore";

export type Sender = "registration" | "payslips" | "documents";
export type SuppressionReason = "unsubscribed" | "bounce" | "complaint";

export interface SuppressionDoc {
  email: string;
  sender: Sender;
  reason: SuppressionReason;
  createdAt: Timestamp;
}

export interface SuppressionInput {
  email: string;
  sender: Sender;
  reason: SuppressionReason;
}

export function isValidSender(value: string): value is Sender {
  return ["registration", "payslips", "documents"].includes(value);
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
