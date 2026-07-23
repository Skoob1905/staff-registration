import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import type { Firestore } from "firebase-admin/firestore";
import type { Storage } from "firebase-admin/storage";
import { dedupFileName } from "../utils/dedupFileName";
import { publishBulkEmailJob } from "../emails/publishEmails";

interface PayslipEntry {
  fileBase64: string;
  fileName: string;
  userId: string;
  agencyId: string;
}

interface BulkPayslipResult {
  fileName: string;
  success: boolean;
  error?: string;
}

async function runWithConcurrency<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  concurrency = 10,
): Promise<void> {
  const executing = new Set<Promise<void>>();
  for (const item of items) {
    const p = fn(item).finally(() => executing.delete(p));
    executing.add(p);
    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }
  await Promise.allSettled(executing);
}

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

  const { uniqueName, filePath } = await dedupFileName(
    bucket,
    `payslips/${uid}`,
    fileName,
  );

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
    fileName: uniqueName,
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
  const newPayslipsSent = [payslipRef.id, ...existing];
  await staffRef.update({
    "metadata.payslipsSent": newPayslipsSent,
    "metadata.payslipsCount": newPayslipsSent.length,
  });

  const staffEmail = (staffSnap.data() as { email?: string })?.email;
  if (staffEmail) {
    await publishBulkEmailJob("payslip", [staffEmail]);
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

export const bulkUploadPayslips = onCall(
  { region: "europe-west2", timeoutSeconds: 540 },
  async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) throw new HttpsError("unauthenticated", "Sign in required.");

    const db = getFirestore();
    const callerSnap = await db.collection("users").doc(callerUid).get();
    if (!callerSnap.exists) {
      throw new HttpsError("permission-denied", "Caller profile missing.");
    }
    const caller = callerSnap.data() as { role?: string; email?: string };
    if (caller.role !== "super") {
      throw new HttpsError("permission-denied", "Super only.");
    }

    const payslips = request.data?.payslips as PayslipEntry[] | undefined;
    if (!Array.isArray(payslips) || payslips.length === 0) {
      throw new HttpsError(
        "invalid-argument",
        "payslips array is required.",
      );
    }

    const results: BulkPayslipResult[] = [];
    const uploaded: {
      userId: string;
      filePath: string;
      fileUrl: string;
      uniqueName: string;
      fileName: string;
      agencyId: string;
    }[] = [];

    const bucket = getStorage().bucket();

    // Phase 1 — upload all files to storage in parallel
    await runWithConcurrency(
      payslips,
      async (entry) => {
        try {
          const uid = entry.userId.toUpperCase();
          const { uniqueName, filePath } = await dedupFileName(
            bucket,
            `payslips/${uid}`,
            entry.fileName,
          );

          const fileRef = bucket.file(filePath);
          const token =
            Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
          const buffer = Buffer.from(entry.fileBase64, "base64");

          await fileRef.save(buffer, {
            metadata: {
              contentType: "application/pdf",
              metadata: { firebaseStorageDownloadTokens: token },
            },
          });

          const fileUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media&token=${token}`;

          uploaded.push({
            userId: uid,
            filePath,
            fileUrl,
            uniqueName,
            fileName: entry.fileName,
            agencyId: entry.agencyId ?? "",
          });
          results.push({ fileName: entry.fileName, success: true });
          await new Promise((r) => setTimeout(r, 1000));
        } catch (err: unknown) {
          results.push({
            fileName: entry.fileName,
            success: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
        await new Promise((r) => setTimeout(r, 1000));
      },
      10,
    );

    if (uploaded.length === 0) {
      return { ok: true, results };
    }

    // Phase 2 — build Firestore data
    const staffPayslipIds = new Map<string, { payslipId: string; payslipRef: FirebaseFirestore.DocumentReference; agencyId: string; fileUrl: string; uniqueName: string }[]>();

    for (const u of uploaded) {
      const payslipRef = db.collection("payslips").doc();
      const existing = staffPayslipIds.get(u.userId) ?? [];
      existing.push({ payslipId: payslipRef.id, payslipRef, agencyId: u.agencyId, fileUrl: u.fileUrl, uniqueName: u.uniqueName });
      staffPayslipIds.set(u.userId, existing);
    }

    // Phase 3 — batch writes to Firestore
    let batch = db.batch();
    let batchCount = 0;

    const commitBatch = async () => {
      if (batchCount > 0) {
        await batch.commit();
        await new Promise((r) => setTimeout(r, 1000));
        batch = db.batch();
        batchCount = 0;
      }
    };

    for (const [userId, entries] of staffPayslipIds) {
      const staffRef = db.collection("staff").doc(userId);
      const payslipIds = entries.map((e) => e.payslipId);

      for (const entry of entries) {
        batch.set(entry.payslipRef, {
          userId,
          agencyId: entry.agencyId,
          fileName: entry.uniqueName,
          fileUrl: entry.fileUrl,
          sentBy: caller.email ?? "Unknown",
          timestamp: FieldValue.serverTimestamp(),
          hasDownloaded: false,
        });
        batchCount++;
      }

      batch.update(staffRef, {
        "metadata.payslipsSent": FieldValue.arrayUnion(...payslipIds),
        "metadata.payslipsCount": FieldValue.increment(payslipIds.length),
      });
      batchCount++;

      if (batchCount >= 100) {
        await commitBatch();
      }
    }

    await commitBatch();

    // Collect staff emails and publish to pub/sub for async delivery
    const staffIds = Array.from(staffPayslipIds.keys());
    const staffSnaps = await Promise.all(
      staffIds.map((id) => db.collection("staff").doc(id).get()),
    );
    const emails: string[] = [];
    for (const snap of staffSnaps) {
      if (snap.exists) {
        const data = snap.data() as { email?: string };
        if (data.email) emails.push(data.email);
      }
    }

    await publishBulkEmailJob("payslip", emails);

    return { ok: true, results, queued: emails.length };
  },
);
