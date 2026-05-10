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
import {getStorage} from "firebase-admin/storage";

initializeApp();

const WEB_API_KEY = defineString("WEB_API_KEY");
const RESET_CONTINUE_URL = defineString("RESET_CONTINUE_URL"); // e.g. http://localhost:5173/login

const normalizeEmail = (value: unknown): string =>
  String(value || "")
    .trim()
    .toLowerCase();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const namePattern = /^[A-Za-z' -]+$/;

export const invitePortalUser = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Sign in required.");

  const email = normalizeEmail(request.data?.email);
  if (!email) throw new HttpsError("invalid-argument", "Email is required.");
  if (!emailPattern.test(email)) {
    throw new HttpsError(
      "invalid-argument",
      "Please enter a valid email address.",
    );
  }

  const db = getFirestore();
  const adminAuth = getAuth();

  const callerSnap = await db.collection("users").doc(callerUid).get();
  if (!callerSnap.exists) {
    throw new HttpsError("permission-denied", "Caller profile missing.");
  }

  const caller = callerSnap.data() as {
    role?: string;
    agencyId?: string;
  };
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
    } else if (authErr.code === "auth/invalid-email") {
      throw new HttpsError(
        "invalid-argument",
        "Please enter a valid email address.",
      );
    } else {
      throw err;
    }
  }

  await db.collection("unregistered_staff").doc(user.uid).set(
    {
      uid: user.uid,
      email,
      agencyId: caller.agencyId,
      role: "user",
      invitedByUid: callerUid,
      status: "awaiting",
      invitedAt: FieldValue.serverTimestamp(),
    },
    {merge: true},
  );

  // Ensure invited staff can authenticate into the app
  // with a role-aware profile.
  await db.collection("users").doc(user.uid).set(
    {
      uid: user.uid,
      email,
      role: "user",
      agencyId: caller.agencyId,
      registrationStatus: "awaiting",
      invitedByUid: callerUid,
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

export const removeUnregisteredStaffUser = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const uid = String(request.data?.uid || "").trim();
  if (!uid) {
    throw new HttpsError("invalid-argument", "A target uid is required.");
  }

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

  const awaitingRef = db.collection("unregistered_staff").doc(uid);
  const awaitingSnap = await awaitingRef.get();
  if (!awaitingSnap.exists) {
    throw new HttpsError(
      "not-found",
      "Awaiting registration record not found.",
    );
  }

  const awaitingData = awaitingSnap.data() as { agencyId?: string };
  if (awaitingData.agencyId !== caller.agencyId) {
    throw new HttpsError(
      "permission-denied",
      "Cannot remove users from another agency.",
    );
  }

  try {
    await adminAuth.deleteUser(uid);
  } catch (err: unknown) {
    const authErr = err as { code?: string };
    if (authErr.code !== "auth/user-not-found") {
      throw err;
    }
  }

  await awaitingRef.delete();

  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  if (userSnap.exists) {
    const userData = userSnap.data() as { agencyId?: string; role?: string };
    if (userData.agencyId === caller.agencyId && userData.role === "user") {
      await userRef.delete();
    }
  }

  return {ok: true, uid};
});

export const registerStaffProfile = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const firstName = String(request.data?.firstName || "")
    .trim()
    .replace(/\s+/g, " ");
  const lastName = String(request.data?.lastName || "")
    .trim()
    .replace(/\s+/g, " ");
  const birthday = String(request.data?.birthday || "").trim();
  const address = String(request.data?.address || "")
    .trim()
    .replace(/\s+/g, " ");
  const honestyConfirmed = Boolean(request.data?.honestyConfirmed);

  if (!firstName || !lastName || !birthday || !address) {
    throw new HttpsError(
      "invalid-argument",
      "All registration fields are required.",
    );
  }
  if (!honestyConfirmed) {
    throw new HttpsError(
      "invalid-argument",
      "You must confirm that your answers are honest.",
    );
  }
  if (firstName.length < 2 || !namePattern.test(firstName)) {
    throw new HttpsError("invalid-argument", "First name is invalid.");
  }
  if (lastName.length < 2 || !namePattern.test(lastName)) {
    throw new HttpsError("invalid-argument", "Last name is invalid.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
    throw new HttpsError("invalid-argument", "Birthday format is invalid.");
  }
  const birthdayDate = new Date(birthday);
  if (
    Number.isNaN(birthdayDate.getTime()) ||
    birthdayDate.getTime() > Date.now()
  ) {
    throw new HttpsError("invalid-argument", "Birthday must be in the past.");
  }
  if (address.length < 8) {
    throw new HttpsError(
      "invalid-argument",
      "Address must be at least 8 characters.",
    );
  }

  const db = getFirestore();
  const awaitingRef = db.collection("unregistered_staff").doc(callerUid);
  const awaitingSnap = await awaitingRef.get();
  if (!awaitingSnap.exists) {
    throw new HttpsError(
      "failed-precondition",
      "No awaiting registration record found.",
    );
  }

  const awaiting = awaitingSnap.data() as {
    agencyId?: string;
    email?: string;
  };
  if (!awaiting.agencyId || !awaiting.email) {
    throw new HttpsError(
      "failed-precondition",
      "Awaiting registration record is incomplete.",
    );
  }

  await db.collection("users").doc(callerUid).set(
    {
      uid: callerUid,
      email: awaiting.email,
      role: "user",
      agencyId: awaiting.agencyId,
      registrationStatus: "registered",
      firstName,
      lastName,
      birthday,
      address,
      honestyConfirmed: true,
      registeredAt: FieldValue.serverTimestamp(),
    },
    {merge: true},
  );

  await awaitingRef.delete();

  return {ok: true};
});

export const markContractSent = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Sign in required.");

  const targetUserId = String(request.data?.targetUserId || "").trim();
  if (!targetUserId) {
    throw new HttpsError("invalid-argument", "targetUserId is required.");
  }

  const db = getFirestore();

  const callerSnap = await db.collection("users").doc(callerUid).get();
  if (!callerSnap.exists) {
    throw new HttpsError("permission-denied", "Caller profile missing.");
  }

  const caller = callerSnap.data() as {
    role?: string;
    agencyId?: string;
    email?: string;
  };
  if (caller.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin only.");
  }

  const targetSnap = await db.collection("users").doc(targetUserId).get();
  if (!targetSnap.exists) {
    throw new HttpsError("not-found", "Target user not found.");
  }

  const target = targetSnap.data() as { agencyId?: string };
  if (target.agencyId !== caller.agencyId) {
    throw new HttpsError(
      "permission-denied",
      "Target user is not in your agency.",
    );
  }

  await db
    .collection("users")
    .doc(targetUserId)
    .set(
      {
        contractSigned: false,
        contractSent: FieldValue.serverTimestamp(),
        contractSentBy: caller.email ?? "Unknown",
      },
      {merge: true},
    );

  return {ok: true};
});

export const markContractSigned = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Sign in required.");

  const db = getFirestore();
  const contractId = String(request.data?.contractId || "").trim();
  const signedFileName = String(request.data?.signedFileName || "").trim();
  const signedFileUrl = String(request.data?.signedFileUrl || "").trim();
  if (!contractId || !signedFileName || !signedFileUrl) {
    throw new HttpsError(
      "invalid-argument",
      "contractId, signedFileName and signedFileUrl are required.",
    );
  }

  const unsignedRef = db.collection("unsigned_contracts").doc(contractId);
  const unsignedSnap = await unsignedRef.get();
  if (!unsignedSnap.exists) {
    throw new HttpsError("not-found", "Unsigned contract not found.");
  }
  const unsignedData = unsignedSnap.data() as {
    targetUserId?: string;
    agencyId?: string;
    fileName?: string;
    fileUrl?: string;
    [key: string]: unknown;
  };
  if (unsignedData.targetUserId !== callerUid) {
    throw new HttpsError("permission-denied", "Not your contract.");
  }

  await db.collection("signed_contracts").add({
    ...unsignedData,
    sourceUnsignedContractId: contractId,
    userId: callerUid,
    originalFileName: unsignedData.fileName ?? null,
    originalFileUrl: unsignedData.fileUrl ?? null,
    fileName: signedFileName,
    fileUrl: signedFileUrl,
    signedAt: FieldValue.serverTimestamp(),
  });

  const originalFileName = String(unsignedData.fileName || "").trim();
  if (originalFileName) {
    const bucket = getStorage().bucket();
    const originalPath = `contracts/unsigned/${callerUid}/${originalFileName}`;
    try {
      await bucket.file(originalPath).delete({ignoreNotFound: true});
    } catch (error) {
      console.error("Failed deleting original unsigned file", {
        contractId,
        originalPath,
        error,
      });
    }
  }

  await unsignedRef.delete();

  const userRef = db.collection("users").doc(callerUid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new HttpsError("not-found", "User profile not found.");
  }

  await userRef.set(
    {
      contractSigned: true,
      contractSignedAt: FieldValue.serverTimestamp(),
    },
    {merge: true},
  );

  return {ok: true, contractId};
});

export const completeUnsignedContract = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Sign in required.");

  const contractId = String(request.data?.contractId || "").trim();
  if (!contractId) {
    throw new HttpsError("invalid-argument", "contractId is required.");
  }

  const db = getFirestore();
  const contractRef = db.collection("unsigned_contracts").doc(contractId);
  const contractSnap = await contractRef.get();
  if (!contractSnap.exists) {
    throw new HttpsError("not-found", "Unsigned contract not found.");
  }

  const contract = contractSnap.data() as {
    targetUserId?: string;
    fileName?: string;
  };
  if (contract.targetUserId !== callerUid) {
    throw new HttpsError("permission-denied", "Not your unsigned contract.");
  }

  const fileName = contract.fileName || "";
  if (fileName) {
    const bucket = getStorage().bucket();
    const objectPath = `contracts/unsigned/${callerUid}/${fileName}`;
    try {
      await bucket.file(objectPath).delete({ignoreNotFound: true});
    } catch (error) {
      console.error("Failed to delete unsigned contract object", {
        contractId,
        objectPath,
        error,
      });
    }
  }

  await contractRef.delete();
  return {ok: true, contractId};
});

export const deleteUserContract = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Sign in required.");

  const targetUserId = String(request.data?.targetUserId || "").trim();
  const mode = String(request.data?.mode || "").trim(); // "unsigned" | "signed"
  if (!targetUserId || (mode !== "unsigned" && mode !== "signed")) {
    throw new HttpsError(
      "invalid-argument",
      "targetUserId and mode (unsigned|signed) are required.",
    );
  }

  const db = getFirestore();
  const callerSnap = await db.collection("users").doc(callerUid).get();
  if (!callerSnap.exists) {
    throw new HttpsError("permission-denied", "Caller profile missing.");
  }
  const caller = callerSnap.data() as {role?: string; agencyId?: string};
  if (caller.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin only.");
  }

  const userRef = db.collection("users").doc(targetUserId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new HttpsError("not-found", "Target user not found.");
  }
  const target = userSnap.data() as {agencyId?: string};
  if (target.agencyId !== caller.agencyId) {
    throw new HttpsError(
      "permission-denied",
      "Target user is not in your agency.",
    );
  }

  const bucket = getStorage().bucket();

  if (mode === "unsigned") {
    const unsignedSnaps = await db
      .collection("unsigned_contracts")
      .where("targetUserId", "==", targetUserId)
      .where("agencyId", "==", caller.agencyId)
      .where("status", "==", "pending")
      .get();

    for (const docSnap of unsignedSnaps.docs) {
      const data = docSnap.data() as {fileName?: string};
      const fileName = String(data.fileName || "").trim();
      if (fileName) {
        const path = `contracts/unsigned/${targetUserId}/${fileName}`;
        await bucket.file(path).delete({ignoreNotFound: true});
      }
      await docSnap.ref.delete();
    }
  } else {
    const signedSnaps = await db
      .collection("signed_contracts")
      .where("userId", "==", targetUserId)
      .where("agencyId", "==", caller.agencyId)
      .get();

    for (const docSnap of signedSnaps.docs) {
      const data = docSnap.data() as {fileName?: string};
      const fileName = String(data.fileName || "").trim();
      if (fileName) {
        const path = `contracts/signed/${targetUserId}/${fileName}`;
        await bucket.file(path).delete({ignoreNotFound: true});
      }
      await docSnap.ref.delete();
    }
  }

  await userRef.set(
    {
      contractSent: FieldValue.delete(),
      contractSentBy: FieldValue.delete(),
      contractSigned: FieldValue.delete(),
      contractSignedAt: FieldValue.delete(),
    },
    {merge: true},
  );

  return {ok: true, targetUserId, mode};
});
