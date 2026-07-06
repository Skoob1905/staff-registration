import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";

export const revokeApiKey = onCall({ region: "europe-west2" }, async (request) => {
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

  await revokeApiKeyLogic(db, label.trim());

  return { ok: true };
});

export async function revokeApiKeyLogic(
  db: FirebaseFirestore.Firestore,
  label: string,
): Promise<void> {
  const existing = await db
    .collection("apiKeys")
    .where("label", "==", label)
    .limit(1)
    .get();

  if (existing.empty) return;

  const batch = db.batch();
  existing.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();
}
