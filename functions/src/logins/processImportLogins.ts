import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { defineString } from "firebase-functions/params";
import type { LoginDoc } from "../types";

const WEB_API_KEY = defineString("WEB_API_KEY");
const RESET_CONTINUE_URL = defineString("RESET_CONTINUE_URL");

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const processImportLogins = onCall(
  { region: "europe-west2" },
  async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid)
      throw new HttpsError("unauthenticated", "Sign in required.");

    const importId = request.data?.importId;
    if (!importId || typeof importId !== "string") {
      throw new HttpsError("invalid-argument", "importId is required.");
    }

    const db = getFirestore();
    const adminAuth = getAuth();

    const importSnap = await db.collection("csv_imports").doc(importId).get();
    if (!importSnap.exists) {
      throw new HttpsError("not-found", "Import not found.");
    }

    const importData = importSnap.data() as {
      type: string;
      agencyId: string;
      importedByUid: string;
      assignedToId?: string | null;
    };

    const loginSnap = await db
      .collection("logins")
      .where("importId", "==", importId)
      .where("pending", "==", true)
      .get();

    if (loginSnap.empty) {
      return { created: 0, skipped: 0, failed: 0 };
    }

    let created = 0;
    let skipped = 0;
    let failed = 0;
    const docs = loginSnap.docs;

    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      const { email, role } = doc.data() as LoginDoc;

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

        const invitedByAgencyId = importData.agencyId || callerUid;
        const userAgencyId: string | undefined =
          importData.type === "staff"
            ? importData.assignedToId || undefined
            : importData.agencyId || undefined;

        const userDoc: Record<string, unknown> = {
          uid: user.uid,
          email,
          role,
          metadata: {
            registered: true,
            invitedByAgencyId,
            invitedByUid: importData.importedByUid,
            invitedAt: FieldValue.serverTimestamp(),
          },
        };
        if (userAgencyId) {
          userDoc.agencyId = userAgencyId;
        }
        await db
          .collection("users")
          .doc(user.uid)
          .set(userDoc, { merge: true });

        const resp = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${WEB_API_KEY.value()}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              requestType: "PASSWORD_RESET",
              email,
              continueUrl: RESET_CONTINUE_URL.value(),
            }),
          },
        );

        if (!resp.ok) {
          const body = await resp.text();
          console.error("[processImportLogins] sendOobCode failed", {
            email,
            status: resp.status,
            body,
          });
          throw new Error(`sendOobCode failed: ${resp.status}`);
        }

        await doc.ref.update({
          pending: false,
          loginSentAt: FieldValue.serverTimestamp(),
        });
        created++;
      } catch (err) {
        console.error("[processImportLogins] failed", {
          email,
          error: err,
        });
        failed++;
      }

      if (i < docs.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return { created, skipped, failed };
  },
);
