import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import type { Firestore } from "firebase-admin/firestore";
import type { Storage } from "firebase-admin/storage";
import { EmailProvider } from "../services/EmailService";

/**
 * Core logic shared by both the single and bulk payslip upload functions.
 *
 * Stores the PDF in Cloud Storage at `payslips/{userId}/{fileName}`, creates a
 * Firestore document in the `payslips` collection, links it to the staff record,
 * and sends a notification email.
 */
export async function uploadPayslipLogic(
  db: Firestore,
  storage: Storage,
  fileBase64: string,
  fileName: string,
  userId: string,
  agencyId: string,
  sentBy: string,
): Promise<{ payslipId: string; url: string }> {
  const uid = userId.toUpperCase();
  const bucket = storage.bucket();
  const filePath = `payslips/${uid}/${fileName}`;
  const fileRef = bucket.file(filePath);

  const token =
    Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const buffer = Buffer.from(fileBase64, "base64");

  await fileRef.save(buffer, {
    metadata: {
      contentType: "application/pdf",
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });

  const fileUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media&token=${token}`;

  const payslipRef = await db.collection("payslips").add({
    userId: uid,
    agencyId: agencyId ?? "",
    fileName,
    fileUrl,
    sentBy,
    timestamp: FieldValue.serverTimestamp(),
    hasDownloaded: false,
  });

  const staffRef = db.collection("staff").doc(uid);
  const staffSnap = await staffRef.get();
  const staffData = staffSnap.data() as {
    metadata?: { payslipsSent?: string[] };
  };
  const existing = staffData?.metadata?.payslipsSent ?? [];
  await staffRef.update({
    metadata: {
      payslipsSent: [payslipRef.id, ...existing],
    },
  });

  const staffEmail = (staffSnap.data() as { email?: string })?.email;
  if (staffEmail) {
    const emailProvider = new EmailProvider();
    await emailProvider.sendPayslipEmail(staffEmail);
  }

  return { payslipId: payslipRef.id, url: fileUrl };
}

export const uploadPayslip = onCall(
  { region: "europe-west2" },
  async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid)
      throw new HttpsError("unauthenticated", "Sign in required.");

    const { fileBase64, fileName, userId, agencyId } = request.data;
    if (!fileBase64 || !fileName || !userId) {
      throw new HttpsError(
        "invalid-argument",
        "fileBase64, fileName, and userId are required.",
      );
    }

    const db = getFirestore();
    const callerSnap = await db.collection("users").doc(callerUid).get();
    if (!callerSnap.exists) {
      throw new HttpsError("permission-denied", "Caller profile missing.");
    }
    const caller = callerSnap.data() as { role?: string; email?: string };
    if (caller.role !== "super") {
      throw new HttpsError("permission-denied", "Super only.");
    }

    const sentBy = caller.email ?? "Unknown";
    const storage = getStorage();
    const result = await uploadPayslipLogic(
      db,
      storage,
      fileBase64,
      fileName,
      userId,
      agencyId,
      sentBy,
    );
    return { ok: true, ...result };
  },
);
