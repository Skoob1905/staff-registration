import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { EmailProvider } from "../services/EmailService";

function normalizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function normalizeEmail(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function findNormalizedValue(
  data: Record<string, unknown>,
  ...targets: string[]
): string | null {
  for (const [key, value] of Object.entries(data)) {
    const nk = normalizeKey(key);
    if (targets.some((t) => normalizeKey(t) === nk)) {
      return String(value ?? "");
    }
  }
  return null;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SendLoginsOptions {
  records: Array<Record<string, unknown>>;
  role: "worker" | "admin" | "client";
  callerUid: string;
  invitedByAgencyId: string;
  agencyId?: string;
}

export interface SendLoginsResult {
  created: number;
  skipped: number;
  failed: number;
}

export async function sendLogins(
  options: SendLoginsOptions,
): Promise<SendLoginsResult> {
  const { records, role, callerUid, invitedByAgencyId, agencyId } = options;
  const db = getFirestore();
  const adminAuth = getAuth();
  const emailProvider = new EmailProvider();

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < records.length; i++) {
    const record = records[i] as Record<string, unknown>;
    const rawEmail = findNormalizedValue(record, "email", "emailaddress") ?? "";
    const email = normalizeEmail(rawEmail);

    if (!email || !emailPattern.test(email)) {
      skipped++;
      continue;
    }

    try {
      let user;
      try {
        user = await adminAuth.getUserByEmail(email);
      } catch (err: unknown) {
        const authErr = err as { code?: string };
        if (authErr.code === "auth/user-not-found") {
          user = await adminAuth.createUser({ email });
        } else {
          throw err;
        }
      }

      const userDoc: Record<string, unknown> = {
        uid: user.uid,
        email,
        role,
        metadata: {
          registered: true,
          invitedByAgencyId,
          invitedByUid: callerUid,
          invitedAt: FieldValue.serverTimestamp(),
        },
      };
      if (agencyId) {
        userDoc.agencyId = agencyId;
      }
      await db.collection("users").doc(user.uid).set(userDoc, { merge: true });

      const resetLink = await emailProvider.generatePasswordResetLink(email);
      const htmlBody = `<p>You have been invited to access the portal.</p><p><a href="${resetLink}">Set your password</a></p>`;

      await emailProvider.sendEmail({
        email,
        subject: "Set your password",
        htmlBody,
      });

      created++;
    } catch (err) {
      console.error("[sendLogins] failed", {
        email,
        error: err,
      });
      failed++;
    }

    if (i < records.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return { created, skipped, failed };
}
