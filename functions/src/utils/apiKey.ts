import { Timestamp } from "firebase-admin/firestore";
import crypto from "crypto";

const ALPHANUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function generateKey(): string {
  const bytes = crypto.randomBytes(10);
  let rawKey = "";
  for (let i = 0; i < 10; i++) {
    rawKey += ALPHANUM[bytes[i] % ALPHANUM.length];
  }
  return rawKey;
}

export function computeExpiry(): Timestamp {
  const date = new Date();
  date.setMonth(date.getMonth() + 3);
  return Timestamp.fromDate(date);
}
