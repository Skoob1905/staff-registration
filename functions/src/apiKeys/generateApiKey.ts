import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { generateKey, computeExpiry } from "../utils/apiKey.js";

export const generateApiKey = onCall({ region: "europe-west2" }, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Sign in required.");

  const db = getFirestore();
  const callerSnap = await db.collection("users").doc(callerUid).get();
  if (!callerSnap.exists) {
    throw new HttpsError("permission-denied", "Caller profile missing.");
  }
  const caller = callerSnap.data() as { role?: string };
  if (caller.role !== "super") {
    throw new HttpsError("permission-denied", "Super only.");
  }

  const label = request.data?.label;
  if (!label || typeof label !== "string" || !label.trim()) {
    throw new HttpsError("invalid-argument", "label is required.");
  }

  return generateApiKeyLogic(db, label.trim());
});

export async function generateApiKeyLogic(
  db: FirebaseFirestore.Firestore,
  label: string,
): Promise<{ apiKey: string; id: string }> {
  if (!label || !label.trim()) {
    throw new Error("label is required.");
  }

  const existing = await db
    .collection("apiKeys")
    .where("label", "==", label)
    .limit(1)
    .get();

  const batch = db.batch();

  existing.forEach((doc) => {
    batch.delete(doc.ref);
  });

  const rawKey = generateKey();
  const expiresAt = computeExpiry();
  const docRef = db.collection("apiKeys").doc();

  batch.set(docRef, {
    apiKey: rawKey,
    label,
    expiresAt,
    lastUsedAt: null,
  });

  await batch.commit();

  return { apiKey: rawKey, id: docRef.id };
}
