/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {setGlobalOptions} from "firebase-functions";
// import { onRequest } from "firebase-functions/https";
// import * as logger from "firebase-functions/logger";

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({maxInstances: 10, region: "europe-west2"});

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

import {onCall, HttpsError} from "firebase-functions/v2/https";
import {defineString} from "firebase-functions/params";
import {initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {FieldValue, getFirestore} from "firebase-admin/firestore";

initializeApp();

const WEB_API_KEY = defineString("WEB_API_KEY");
const RESET_CONTINUE_URL = defineString("RESET_CONTINUE_URL"); // e.g. http://localhost:5173/login

const normalizeEmail = (value: unknown): string =>
  String(value || "")
    .trim()
    .toLowerCase();

export const invitePortalUser = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Sign in required.");

  const email = normalizeEmail(request.data?.email);
  if (!email) throw new HttpsError("invalid-argument", "Email is required.");

  const db = getFirestore();
  const adminAuth = getAuth();

  const callerSnap = await db.collection("users").doc(callerUid).get();
  if (!callerSnap.exists) {
    throw new HttpsError("permission-denied", "Caller profile missing.");
  }

  const caller = callerSnap.data() as { role?: string; agencyId?: string };
  if (caller.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin only.");
  }
  if (!caller.agencyId) {
    throw new HttpsError("failed-precondition", "Admin has no agencyId.");
  }

  const existingRegistered = await db
    .collection("users")
    .where("email", "==", email)
    .where("agencyId", "==", caller.agencyId)
    .limit(1)
    .get();
  if (!existingRegistered.empty) {
    throw new HttpsError("already-exists", "Email is already registered.");
  }

  const existingAwaiting = await db
    .collection("unregistered_staff")
    .where("email", "==", email)
    .where("agencyId", "==", caller.agencyId)
    .limit(1)
    .get();
  if (!existingAwaiting.empty) {
    throw new HttpsError(
      "already-exists",
      "Email is already awaiting registration.",
    );
  }

  let user;
  try {
    user = await adminAuth.getUserByEmail(email);
  } catch (err: unknown) {
    const authErr = err as { code?: string };
    if (authErr.code === "auth/user-not-found") {
      user = await adminAuth.createUser({email});
    } else {
      throw err;
    }
  }

  await db.collection("unregistered_staff").doc(user.uid).set(
    {
      uid: user.uid,
      email,
      agencyId: caller.agencyId,
      invitedByUid: callerUid,
      status: "awaiting",
      invitedAt: FieldValue.serverTimestamp(),
    },
    {merge: true},
  );

  // Triggers Firebase password-reset email template
  // (used as set-password invite).
  const resp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${WEB_API_KEY.value()}`,
    {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        requestType: "PASSWORD_RESET",
        email,
        continueUrl: RESET_CONTINUE_URL.value(),
      }),
    },
  );

  if (!resp.ok) {
    const errorText = await resp.text();
    console.error("sendOobCode failed", {
      status: resp.status,
      statusText: resp.statusText,
      body: errorText,
      email,
    });
    throw new HttpsError(
      "internal",
      "Failed to send invite email: " +
        `${resp.status} ${resp.statusText} ${errorText}`,
    );
  }

  return {ok: true, userId: user.uid};
});
