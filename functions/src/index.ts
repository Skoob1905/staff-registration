/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { setGlobalOptions } from "firebase-functions";

// import { onRequest } from "firebase-functions/https";
import * as logger from "firebase-functions/logger";

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

import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { algoliasearch } from "algoliasearch";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getStaffRef, getAgencyRef, getClientRef } from "./utils/getFileRef";
import { dedupRecords } from "./utils/dedup";
import { createAuthUsers } from "./utils/createAuthUsers";
import { removeAuthUser } from "./utils/removeAuthUser";
import type { LoginDoc } from "./types";
import { EmailProvider } from "./services/EmailService";
import { ResetPasswordTokenManager } from "./resetPasswordToken";

// API Keys for external users using the API
export { generateApiKey, revokeApiKey, uploadPayslipExternal } from "./apiKeys";

// Payslip operations
export { uploadPayslip } from "./payslips";

// Email suppression
export { unsubscribeEmail } from "./emailSuppressions";

const ALGOLIA_APP_ID = defineString("ALGOLIA_APP_ID");
const ALGOLIA_ADMIN_API_KEY = defineString("ALGOLIA_ADMIN_API_KEY");
const ALGOLIA_INDEX_PREFIX = defineString("ALGOLIA_INDEX_PREFIX");
const DOCUMENT_UPLOAD_DELAY = defineString("DOCUMENT_UPLOAD_DELAY");
const RESET_CONTINUE_URL = defineString("RESET_CONTINUE_URL");

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

setGlobalOptions({ maxInstances: 10, region: "europe-west2" });

initializeApp();

const normalizeEmail = (value: unknown): string =>
  String(value || "")
    .trim()
    .toLowerCase();

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const namePattern = /^[A-Za-z' -]+$/;

const normalizeKey = (key: string): string =>
  key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

const BUSINESS_NAME_NORMALIZED_VARIANTS = new Set([
  "businessname",
  "business",
  "companyname",
  "company",
  "organisationname",
  "organisation",
  "organizationname",
  "organization",
  "agencyname",
  "agency",
  "clientname",
  "client",
  "firmname",
  "firm",
  "employername",
  "employer",
  "entityname",
  "entity",
]);

const getBusinessName = (row: Record<string, unknown>): string => {
  for (const [key, value] of Object.entries(row)) {
    if (BUSINESS_NAME_NORMALIZED_VARIANTS.has(normalizeKey(key))) {
      return String(value ?? "");
    }
  }
  return "";
};

const findNormalizedValue = (
  data: Record<string, unknown>,
  ...targets: string[]
): string | null => {
  for (const [key, value] of Object.entries(data)) {
    const nk = normalizeKey(key);
    if (targets.some((t) => normalizeKey(t) === nk)) {
      return String(value ?? "");
    }
  }
  return null;
};

/**
 * Invites a portal user by creating a Firebase Auth account and a Firestore
 * user profile. Sends a client registration email with a password reset link.
 *
 * Requires caller role: `admin` or `super`.
 *
 * @param request.data.email - The email address to invite.
 * @returns `{ ok: true, userId: string }` on success.
 * @throws {HttpsError} "unauthenticated" if not signed in.
 * @throws {HttpsError} "permission-denied" if caller is not admin/super.
 * @throws {HttpsError} "invalid-argument" if email is missing or invalid.
 * @throws {HttpsError} "already-exists" if email is already registered or awaiting.
 */
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
  if (caller.role !== "admin" && caller.role !== "super") {
    throw new HttpsError("permission-denied", "Admin or Super only.");
  }
  if (!caller.agencyId && caller.role !== "super") {
    throw new HttpsError("failed-precondition", "Admin has no agencyId.");
  }

  const callerAgencyId = caller.agencyId ?? "";

  const existingRegistered = await db
    .collection("users")
    .where("email", "==", email)
    .where("agencyId", "==", callerAgencyId)
    .limit(1)
    .get();
  if (!existingRegistered.empty) {
    throw new HttpsError("already-exists", "Email is already registered.");
  }

  const existingAwaiting = await db
    .collection("unregistered_staff")
    .where("email", "==", email)
    .where("agencyId", "==", callerAgencyId)
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
      user = await adminAuth.createUser({ email });
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
      agencyId: callerAgencyId,
      role: "client",
      invitedByUid: callerUid,
      status: "awaiting",
      invitedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  // Ensure invited staff can authenticate into the app
  // with a role-aware profile.
  await db.collection("users").doc(user.uid).set(
    {
      uid: user.uid,
      email,
      role: "client",
      agencyId: callerAgencyId,
      invitedByAgencyId: callerAgencyId,
      invitedByUid: callerUid,
      invitedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  const emailProvider = new EmailProvider();
  try {
    logger.info("[invitePortalUser] sending client registration email", {
      email,
    });
    await emailProvider.sendClientRegistrationLink(email);
  } catch (err) {
    logger.error("[invitePortalUser] failed to send registration email", {
      email,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  await db
    .collection("users")
    .doc(user.uid)
    .set({ loginStatus: "awaiting_login" }, { merge: true });

  const staffSnaps = await db
    .collection("staff")
    .where("email", "==", email)
    .get();
  for (const d of staffSnaps.docs) {
    await d.ref.update("metadata.loginStatus", "awaiting_login");
    await db
      .collection("users")
      .doc(user.uid)
      .set({ workerRef: d.id }, { merge: true });
  }

  return { ok: true, userId: user.uid };
});

/**
 * Assigns a client login to a specific agency. Creates a Firebase Auth
 * account if one does not exist, writes a Firestore user profile with
 * role `client`, and sends a client registration email.
 *
 * Requires caller role: `admin` or `super`.
 *
 * @param request.data.email      - The email address to assign.
 * @param request.data.agencyDocId - The Firestore document ID of the agency.
 * @returns `{ ok: true, userId: string }` on success.
 * @throws {HttpsError} "unauthenticated" if not signed in.
 * @throws {HttpsError} "permission-denied" if caller is not admin/super.
 * @throws {HttpsError} "invalid-argument" if email or agencyDocId is missing/invalid.
 * @throws {HttpsError} "already-exists" if email is already registered or awaiting.
 * @throws {HttpsError} "failed-precondition" if admin caller has no agencyId.
 */
export const assignClientLogin = onCall(async (request) => {
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

  const agencyDocId = String(request.data?.agencyDocId || "").trim();
  if (!agencyDocId) {
    throw new HttpsError("invalid-argument", "agencyDocId is required.");
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
    email?: string;
  };
  if (caller.role !== "admin" && caller.role !== "super") {
    throw new HttpsError("permission-denied", "Admin or Super only.");
  }
  if (!caller.agencyId && caller.role !== "super") {
    throw new HttpsError("failed-precondition", "Admin has no agencyId.");
  }

  const agencySnap = await db.collection("agencies").doc(agencyDocId).get();
  if (!agencySnap.exists) {
    throw new HttpsError("not-found", "Agency/company not found.");
  }

  const [existingRegistered, existingAwaiting] = await Promise.all([
    db
      .collection("users")
      .where("email", "==", email)
      .where("agencyId", "==", agencyDocId)
      .limit(1)
      .get(),
    db
      .collection("unregistered_staff")
      .where("email", "==", email)
      .where("agencyId", "==", agencyDocId)
      .limit(1)
      .get(),
  ]);
  if (!existingRegistered.empty) {
    throw new HttpsError("already-exists", "Email is already registered.");
  }
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
      user = await adminAuth.createUser({ email });
    } else if (authErr.code === "auth/invalid-email") {
      throw new HttpsError(
        "invalid-argument",
        "Please enter a valid email address.",
      );
    } else {
      throw err;
    }
  }

  await db
    .collection("users")
    .doc(user.uid)
    .set(
      {
        uid: user.uid,
        email,
        role: "client",
        agencyId: agencyDocId,
        invitedByAgencyId: caller.agencyId ?? callerUid,
        invitedByUid: callerUid,
        invitedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

  const emailProvider = new EmailProvider();
  try {
    logger.info("[assignClientLogin] sending client registration email", {
      email,
    });
    await emailProvider.sendClientRegistrationLink(email);
  } catch (err) {
    logger.error("[assignClientLogin] failed to send registration email", {
      email,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  await db
    .collection("users")
    .doc(user.uid)
    .set({ loginStatus: "awaiting_login" }, { merge: true });

  return { ok: true, userId: user.uid };
});

/**

/**
 * Sends a password reset email to the specified address.
 *
 * Generates a custom Firestore-backed reset token and sends the user an
 * email containing the reset link. Does not require authentication — this
 * is the public forgot-password endpoint.
 *
 * @param request.data.email - The email address to send the reset link to.
 * @returns `{ ok: true }` on success.
 * @throws {HttpsError} "invalid-argument" if email is missing.
 * @throws {HttpsError} "not-found" if the email does not correspond to a
 *         Firebase Auth user.
 */
export const sendPasswordReset = onCall(async (request) => {
  const email = normalizeEmail(request.data?.email);
  if (!email) throw new HttpsError("invalid-argument", "Email is required.");

  const db = getFirestore();
  const adminAuth = getAuth();
  const emailProvider = new EmailProvider();

  const manager = new ResetPasswordTokenManager(
    db,
    adminAuth,
    `${RESET_CONTINUE_URL.value()}/reset-password`,
  );

  try {
    const resetLink = await manager.getResetLink(email);
    await emailProvider.sendResetPassword(email, resetLink);
  } catch (err) {
    logger.error("[sendPasswordReset] failed", {
      email,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  return { ok: true };
});

/**
 * Completes a password reset by validating a custom token and updating the
 * user's password via the Admin SDK.
 *
 * This is the counterpart to `sendPasswordReset` and handles the second
 * half of the custom reset flow. The token must:
 * 1. Exist in the `passwordResets` Firestore collection.
 * 2. Not have expired (based on the custom expiry set at creation).
 * 3. Be accompanied by a password of at least 6 characters.
 *
 * Does not require authentication — the token itself is the credential.
 *
 * @param request.data.token - The 64-char hex reset token.
 * @param request.data.newPassword - The new password (min 6 chars).
 * @returns `{ success: true }` on success.
 * @throws {HttpsError} "invalid-argument" if token or password is missing
 *         or the password is too short.
 * @throws {HttpsError} "not-found" if the token document does not exist.
 * @throws {HttpsError} "failed-precondition" if the token has expired.
 */
export const completePasswordReset = onCall(async (request) => {
  const token = String(request.data?.token || "").trim();
  const newPassword = String(request.data?.newPassword || "");

  if (!token) {
    throw new HttpsError("invalid-argument", "Token is required.");
  }

  if (!newPassword || newPassword.length < 6) {
    throw new HttpsError(
      "invalid-argument",
      "Password must be at least 6 characters.",
    );
  }

  const db = getFirestore();
  const adminAuth = getAuth();
  const manager = new ResetPasswordTokenManager(
    db,
    adminAuth,
    `${RESET_CONTINUE_URL.value()}/reset-password`,
  );

  try {
    const { email } = await manager.completeReset(token, newPassword);
    return { success: true, email };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    switch (message) {
      case "INVALID_TOKEN":
        throw new HttpsError(
          "not-found",
          "INVALID_TOKEN:Invalid or missing reset token.",
        );
      case "TOKEN_EXPIRED":
        throw new HttpsError(
          "failed-precondition",
          "TOKEN_EXPIRED:This password reset link has expired.",
        );
      case "INVALID_PASSWORD":
        throw new HttpsError(
          "invalid-argument",
          "INVALID_PASSWORD:Password must be at least 6 characters.",
        );
      default:
        throw error;
    }
  }
});

/**
 * Validates a reset token without completing the reset.
 *
 * Checks whether the token exists, has not been used, and has not expired.
 * This is called on the reset page mount so the client can redirect
 * immediately if the link is stale.
 *
 * Does not require authentication — the token itself is the credential.
 *
 * @param request.data.token - The 64-char hex reset token.
 * @returns `{ valid: true }` or `{ valid: false, reason }`.
 */
export const validateResetToken = onCall(async (request) => {
  const token = String(request.data?.token || "").trim();
  if (!token) {
    return { valid: false, reason: "INVALID_TOKEN" };
  }

  const db = getFirestore();
  const adminAuth = getAuth();
  const manager = new ResetPasswordTokenManager(
    db,
    adminAuth,
    `${RESET_CONTINUE_URL.value()}/reset-password`,
  );

  return manager.validateToken(token);
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
  if (caller.role !== "admin" && caller.role !== "super") {
    throw new HttpsError("permission-denied", "Admin or Super only.");
  }
  if (!caller.agencyId && caller.role !== "super") {
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
    if (userData.agencyId === caller.agencyId && userData.role === "client") {
      await userRef.delete();
    }
  }

  return { ok: true, uid };
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
    invitedByAgencyId?: string;
    email?: string;
  };
  if (!awaiting.agencyId || !awaiting.email) {
    throw new HttpsError(
      "failed-precondition",
      "Awaiting registration record is incomplete.",
    );
  }

  const staffAgencyId = awaiting.invitedByAgencyId || awaiting.agencyId;
  const staffSnap = await db
    .collection("staff")
    .where("email", "==", awaiting.email)
    .where("agencyId", "==", staffAgencyId)
    .limit(1)
    .get();

  let assignedToId = "";
  if (!staffSnap.empty) {
    const staffData = staffSnap.docs[0].data() as {
      metadata?: { assignedToId?: string };
    };
    assignedToId = staffData.metadata?.assignedToId ?? "";
  }

  await db
    .collection("users")
    .doc(callerUid)
    .set(
      {
        uid: callerUid,
        email: awaiting.email,
        role: "client",
        agencyId: awaiting.agencyId,
        ...(assignedToId ? { assignedToId } : {}),
        registrationStatus: "registered",
        firstName,
        lastName,
        birthday,
        address,
        honestyConfirmed: true,
        registeredAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

  await awaitingRef.delete();

  return { ok: true };
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
  if (caller.role !== "admin" && caller.role !== "super") {
    throw new HttpsError("permission-denied", "Admin or Super only.");
  }

  const targetSnap = await db.collection("users").doc(targetUserId).get();
  if (!targetSnap.exists) {
    throw new HttpsError("not-found", "Target user not found.");
  }

  const target = targetSnap.data() as { agencyId?: string };
  if (caller.role !== "super" && target.agencyId !== caller.agencyId) {
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
      { merge: true },
    );

  return { ok: true };
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
      await bucket.file(originalPath).delete({ ignoreNotFound: true });
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
    { merge: true },
  );

  return { ok: true, contractId };
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
      await bucket.file(objectPath).delete({ ignoreNotFound: true });
    } catch (error) {
      console.error("Failed to delete unsigned contract object", {
        contractId,
        objectPath,
        error,
      });
    }
  }

  await contractRef.delete();
  return { ok: true, contractId };
});

export const updatePayslipDownloadedStatus = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Sign in required.");

  const payslipId = String(request.data?.payslipId || "").trim();
  if (!payslipId) {
    throw new HttpsError("invalid-argument", "payslipId is required.");
  }

  const db = getFirestore();
  const payslipRef = db.collection("payslips").doc(payslipId);
  const payslipSnap = await payslipRef.get();
  if (!payslipSnap.exists) {
    throw new HttpsError("not-found", "Payslip not found.");
  }

  const payslip = payslipSnap.data() as { userId?: string };
  if (payslip.userId !== callerUid) {
    throw new HttpsError("permission-denied", "Not your payslip.");
  }

  await payslipRef.set(
    {
      hasDownloaded: true,
      downloadedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return { ok: true, payslipId };
});

/**
 * Imports agency records from a CSV payload. Performs server-side
 * duplicate detection scoped to the caller's agency, writes new
 * records to Firestore, creates pending login documents, records
 * an entry in the `csv_imports` collection, and batch-sends
 * agency registration emails at 1-second intervals.
 *
 * Requires caller role: `admin` or `super`.
 *
 * @param request.data.records      - Array of CSV row objects.
 * @param request.data.fileName     - Original CSV filename.
 * @param request.data.fileUrl      - Storage URL of the uploaded CSV.
 * @param request.data.totalRecords - Total rows before dedup (for logging).
 * @returns `{ ok: true, added: number, duplicates: number, total: number, importId: string }`.
 * @throws {HttpsError} "unauthenticated" if not signed in.
 * @throws {HttpsError} "permission-denied" if caller is not admin/super.
 * @throws {HttpsError} "invalid-argument" if records array is empty or missing.
 */
export const importAgencyCsv = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Sign in required.");

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
  if (caller.role !== "admin" && caller.role !== "super") {
    throw new HttpsError("permission-denied", "Admin or Super only.");
  }

  const records = request.data?.records;
  if (!Array.isArray(records) || records.length === 0) {
    throw new HttpsError(
      "invalid-argument",
      "A non-empty records array is required.",
    );
  }

  const fileName = String(request.data?.fileName || "unknown.csv");
  const fileUrl = String(request.data?.fileUrl || "");

  const { newRecords, duplicateCount } = await dedupRecords({
    db,
    collectionName: "agencies",
    oldQueryField: "importedByAgencyId",
    newQueryField: "metadata.uploadedBy",
    records,
    getKey: getAgencyRef,
    agencyId: caller.agencyId ?? undefined,
  });

  for (const record of newRecords) {
    const emailVal = findNormalizedValue(record, "email", "emailaddress");
    if (emailVal) {
      record["email"] = normalizeEmail(emailVal);
    }
    record["ref"] = getAgencyRef(record) || "";
  }

  if (newRecords.length === 0) {
    return {
      ok: true,
      added: 0,
      duplicates: duplicateCount,
      total: records.length,
      importId: "",
      emails: [],
    };
  }

  const importRef = db.collection("csv_imports").doc();
  const importId = importRef.id;

  const BATCH_LIMIT = 500;
  let writtenCount = 0;

  const uploadedBy = caller.agencyId ?? callerUid;
  const agencyDocIds = new Map<string, string>();

  for (let i = 0; i < newRecords.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    const chunk = newRecords.slice(i, i + BATCH_LIMIT);
    for (const record of chunk) {
      const docRef = db.collection("agencies").doc();
      const rawEmail = findNormalizedValue(record, "email", "emailaddress");
      const email = rawEmail ? normalizeEmail(rawEmail) : "";
      if (email && emailPattern.test(email)) {
        agencyDocIds.set(email, docRef.id);
      }
      const meta = {
        uploadedInFile: importId,
        uploadedBy,
        importedAt: FieldValue.serverTimestamp(),
      };
      batch.set(docRef, {
        ...record,
        metadata: meta,
      });
    }
    await batch.commit();
    writtenCount += chunk.length;
  }

  const totalRecords = Number(request.data?.totalRecords) || records.length;

  await importRef.set({
    type: "agency",
    agencyId: caller.agencyId ?? "",
    fileName,
    fileUrl: fileUrl || null,
    recordCount: newRecords.length,
    totalRecords,
    importedByUid: callerUid,
    importedByEmail: caller.email ?? null,
    importedAt: FieldValue.serverTimestamp(),
  });

  const loginsBatch = db.batch();
  let loginCount = 0;
  const emails: string[] = [];
  for (const record of newRecords) {
    const rawEmail = findNormalizedValue(record, "email", "emailaddress");
    if (!rawEmail) continue;
    const email = normalizeEmail(rawEmail);
    if (!email || !emailPattern.test(email)) continue;
    const loginRef = db.collection("logins").doc(email);
    loginsBatch.set(loginRef, {
      email,
      role: "client",
      importId,
      pending: true,
      requestedAt: FieldValue.serverTimestamp(),
      requestedBy: callerUid,
    } as LoginDoc);
    loginCount++;
    emails.push(email);
  }
  if (loginCount > 0) await loginsBatch.commit();

  const confirmed = await createAuthUsers(
    emails.map((email) => ({
      email,
      role: "client",
      agencyId: agencyDocIds.get(email) ?? "",
      invitedByUid: callerUid,
    })),
  );

  return {
    ok: true,
    added: writtenCount,
    duplicates: duplicateCount,
    total: records.length,
    importId,
    emails: confirmed.map((c) => c.email),
  };
});

/**
 * Imports client records from a CSV payload. Performs server-side
 * duplicate detection scoped to the caller's agency, writes new
 * records to Firestore, creates pending login documents, records
 * an entry in the `csv_imports` collection, and batch-sends
 * client registration emails at 1-second intervals.
 *
 * Requires caller role: `admin` or `super`.
 *
 * @param request.data.records      - Array of CSV row objects.
 * @param request.data.fileName     - Original CSV filename.
 * @param request.data.fileUrl      - Storage URL of the uploaded CSV.
 * @param request.data.totalRecords - Total rows before dedup (for logging).
 * @returns `{ ok: true, added: number, duplicates: number, total: number, importId: string }`.
 * @throws {HttpsError} "unauthenticated" if not signed in.
 * @throws {HttpsError} "permission-denied" if caller is not admin/super.
 * @throws {HttpsError} "invalid-argument" if records array is empty or missing.
 */
export const importClientCsv = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Sign in required.");

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
  if (caller.role !== "admin" && caller.role !== "super") {
    throw new HttpsError("permission-denied", "Admin or Super only.");
  }

  const records = request.data?.records;
  if (!Array.isArray(records) || records.length === 0) {
    throw new HttpsError(
      "invalid-argument",
      "A non-empty records array is required.",
    );
  }

  const fileName = String(request.data?.fileName || "unknown.csv");
  const fileUrl = String(request.data?.fileUrl || "");

  const { newRecords, duplicateCount } = await dedupRecords({
    db,
    collectionName: "clients",
    oldQueryField: "importedByAgencyId",
    newQueryField: "metadata.uploadedBy",
    records,
    getKey: getClientRef,
    agencyId: caller.agencyId ?? undefined,
  });

  for (const record of newRecords) {
    const emailVal = findNormalizedValue(record, "email", "emailaddress");
    if (emailVal) {
      record["email"] = normalizeEmail(emailVal);
    }
    record["ref"] = getClientRef(record) || "";
  }

  if (newRecords.length === 0) {
    return {
      ok: true,
      added: 0,
      duplicates: duplicateCount,
      total: records.length,
      importId: "",
      emails: [],
    };
  }

  const importRef = db.collection("csv_imports").doc();
  const importId = importRef.id;

  const BATCH_LIMIT = 500;
  let writtenCount = 0;

  const uploadedBy = caller.agencyId ?? callerUid;
  const clientDocIds = new Map<string, string>();

  for (let i = 0; i < newRecords.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    const chunk = newRecords.slice(i, i + BATCH_LIMIT);
    for (const record of chunk) {
      const docRef = db.collection("clients").doc();
      const rawEmail = findNormalizedValue(record, "email", "emailaddress");
      const email = rawEmail ? normalizeEmail(rawEmail) : "";
      if (email && emailPattern.test(email)) {
        clientDocIds.set(email, docRef.id);
      }
      const meta = {
        uploadedInFile: importId,
        uploadedBy,
        importedAt: FieldValue.serverTimestamp(),
      };
      batch.set(docRef, {
        ...record,
        metadata: meta,
      });
    }
    await batch.commit();
    writtenCount += chunk.length;
  }

  const totalRecords = Number(request.data?.totalRecords) || records.length;

  await importRef.set({
    type: "client",
    agencyId: caller.agencyId ?? "",
    fileName,
    fileUrl: fileUrl || null,
    recordCount: newRecords.length,
    totalRecords,
    importedByUid: callerUid,
    importedByEmail: caller.email ?? null,
    importedAt: FieldValue.serverTimestamp(),
  });

  const loginsBatch = db.batch();
  let loginCount = 0;
  const emails: string[] = [];
  for (const record of newRecords) {
    const rawEmail = findNormalizedValue(record, "email", "emailaddress");
    if (!rawEmail) continue;
    const email = normalizeEmail(rawEmail);
    if (!email || !emailPattern.test(email)) continue;
    const loginRef = db.collection("logins").doc(email);
    loginsBatch.set(loginRef, {
      email,
      role: "admin",
      importId,
      pending: true,
      requestedAt: FieldValue.serverTimestamp(),
      requestedBy: callerUid,
    } as LoginDoc);
    loginCount++;
    emails.push(email);
  }
  if (loginCount > 0) await loginsBatch.commit();

  const confirmed = await createAuthUsers(
    emails.map((email) => ({
      email,
      role: "admin",
      agencyId: clientDocIds.get(email) ?? "",
      invitedByUid: callerUid,
    })),
  );

  return {
    ok: true,
    added: writtenCount,
    duplicates: duplicateCount,
    total: records.length,
    importId,
    emails: confirmed.map((c) => c.email),
  };
});

/**
 * Imports staff (worker) records from a CSV payload. Performs global
 * server-side duplicate detection (across all agencies), writes new
 * records to Firestore with optional tag and assignment metadata,
 * creates pending login documents, records an entry in the
 * `csv_imports` collection, and batch-sends worker registration
 * emails at 1-second intervals.
 *
 * Requires caller role: `super` only.
 *
 * @param request.data.records        - Array of CSV row objects.
 * @param request.data.fileName       - Original CSV filename.
 * @param request.data.fileUrl        - Storage URL of the uploaded CSV.
 * @param request.data.totalRecords   - Total rows before dedup (for logging).
 * @param request.data.assignedToId   - (Optional) Agency ID to assign staff to.
 * @param request.data.assignedToName - (Optional) Agency name for metadata.
 * @param request.data.tagIds         - (Optional) Array of tag IDs to apply.
 * @returns `{ ok: true, added: number, duplicates: number, total: number, importId: string }`.
 * @throws {HttpsError} "unauthenticated" if not signed in.
 * @throws {HttpsError} "permission-denied" if caller is not super.
 * @throws {HttpsError} "invalid-argument" if records array is empty or missing.
 */
export const importStaffCsv = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Sign in required.");

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
  if (caller.role !== "super") {
    throw new HttpsError("permission-denied", "Super only.");
  }

  const records = request.data?.records;
  if (!Array.isArray(records) || records.length === 0) {
    throw new HttpsError(
      "invalid-argument",
      "A non-empty records array is required.",
    );
  }

  const fileName = String(request.data?.fileName || "unknown.csv");
  const fileUrl = String(request.data?.fileUrl || "");

  const { newRecords, duplicateCount } = await dedupRecords({
    db,
    collectionName: "staff",
    records,
    getKey: getStaffRef,
    fetchAll: true,
  });

  let assignedToId = request.data?.assignedToId
    ? String(request.data.assignedToId)
    : null;
  const assignedToNameInput = request.data?.assignedToName
    ? String(request.data.assignedToName)
    : null;

  if (!assignedToId && caller.agencyId) {
    assignedToId = caller.agencyId;
  }
  const callerAgencySnap = assignedToId
    ? await db.collection("agencies").doc(assignedToId).get()
    : null;
  const assignedToName =
    assignedToNameInput ||
    (callerAgencySnap?.exists
      ? ((callerAgencySnap.data() as { name?: string }).name ?? "")
      : "");

  const tagIds = request.data?.tagIds as string[] | undefined;

  for (const record of newRecords) {
    const forename = findNormalizedValue(record, "forename", "firstname");
    const surname = findNormalizedValue(record, "surname", "lastname");
    const fullName = findNormalizedValue(record, "fullname");

    if (fullName) {
      const trimmed = fullName.trim();
      const firstSpace = trimmed.indexOf(" ");
      if (firstSpace > 0) {
        record["Forename"] = trimmed.slice(0, firstSpace).trim();
        record["Surname"] = trimmed.slice(firstSpace + 1).trim();
      } else {
        record["Forename"] = trimmed;
      }
    } else if (forename || surname) {
      record["Forename"] = forename ?? "";
      record["Surname"] = surname ?? "";
    }

    const emailVal = findNormalizedValue(record, "email", "emailaddress");
    if (emailVal) {
      record["email"] = normalizeEmail(emailVal);
    }

    record["ref"] = getStaffRef(record) || "";
  }

  if (newRecords.length === 0) {
    return {
      ok: true,
      added: 0,
      duplicates: duplicateCount,
      total: records.length,
      importId: "",
      emails: [],
    };
  }

  const importRef = db.collection("csv_imports").doc();
  const importId = importRef.id;

  const BATCH_LIMIT = 500;
  let writtenCount = 0;
  const newStaffIds: string[] = [];

  for (let i = 0; i < newRecords.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    const chunk = newRecords.slice(i, i + BATCH_LIMIT);
    for (const record of chunk) {
      const staffRef = getStaffRef(record);
      const docRef = staffRef
        ? db.collection("staff").doc(staffRef)
        : db.collection("staff").doc();
      batch.set(docRef, {
        ...record,
        ...(tagIds && tagIds.length > 0 ? { tags: tagIds } : {}),
        metadata: {
          role: "worker",
          uploadedInFile: importId,
          uploadedBy: caller.agencyId ?? callerUid,
          importedAt: FieldValue.serverTimestamp(),
          ...(assignedToId
            ? {
                assignedToId,
                assignedToName,
                assignedBy: caller.email,
                assignedAt: FieldValue.serverTimestamp(),
              }
            : {}),
        },
      });
      if (staffRef) newStaffIds.push(staffRef);
    }
    await batch.commit();
    writtenCount += chunk.length;
  }

  if (assignedToId && newStaffIds.length > 0) {
    await db
      .collection("agencies")
      .doc(assignedToId)
      .update({
        assignedStaff: FieldValue.delete(),
        "metadata.assignedStaff": FieldValue.arrayUnion(...newStaffIds),
      });
  }

  const totalRecords = Number(request.data?.totalRecords) || records.length;

  await importRef.set({
    type: "staff",
    agencyId: caller.agencyId ?? "",
    fileName,
    fileUrl: fileUrl || null,
    recordCount: newRecords.length,
    totalRecords,
    importedByUid: callerUid,
    importedByEmail: caller.email ?? null,
    importedAt: FieldValue.serverTimestamp(),
    assignedToId: assignedToId || null,
  });

  const loginsBatch = db.batch();
  let loginCount = 0;
  const emails: string[] = [];
  for (const record of newRecords) {
    const rawEmail = findNormalizedValue(record, "email", "emailaddress");
    if (!rawEmail) continue;
    const email = normalizeEmail(rawEmail);
    if (!email || !emailPattern.test(email)) continue;
    const loginRef = db.collection("logins").doc(email);
    loginsBatch.set(loginRef, {
      email,
      role: "worker",
      importId,
      pending: true,
      requestedAt: FieldValue.serverTimestamp(),
      requestedBy: callerUid,
    } as LoginDoc);
    loginCount++;
    emails.push(email);
  }
  if (loginCount > 0) await loginsBatch.commit();

  const confirmed = await createAuthUsers(
    emails.map((email) => ({
      email,
      role: "worker",
      agencyId: caller.agencyId ?? "",
      invitedByUid: callerUid,
    })),
  );

  return {
    ok: true,
    added: writtenCount,
    duplicates: duplicateCount,
    total: records.length,
    importId,
    emails: confirmed.map((c) => c.email),
  };
});

/**
 * Sends registration emails for imported records. Auth users are created
 * during the import step by {@link createAuthUsers}; only emails with
 * confirmed Auth accounts should be passed here.
 *
 * @param request.data.emails - Array of email addresses to send to.
 * @param request.data.type   - "worker", "agency", or "client".
 * @returns A {@link BatchEmailResult} with sent / failed counts.
 * @throws {HttpsError} "unauthenticated" if not signed in.
 * @throws {HttpsError} "invalid-argument" if emails or type are invalid.
 */
export const sendImportEmails = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Sign in required.");

  const { emails, type } = request.data as {
    emails: string[];
    type: "worker" | "agency" | "client";
  };

  if (!Array.isArray(emails) || emails.length === 0 || !type) {
    throw new HttpsError(
      "invalid-argument",
      "emails array and type are required.",
    );
  }

  const emailProvider = new EmailProvider();

  let callback: (params: { email: string }) => Promise<void>;
  switch (type) {
    case "worker":
      callback = async ({ email }) => {
        try {
          await emailProvider.sendWorkerRegistrationLink(email);
        } catch (err) {
          logger.error("[sendImportEmails] worker registration email failed", {
            email,
            error: err instanceof Error ? err.message : String(err),
          });
          const snaps = await getFirestore()
            .collection("staff")
            .where("email", "==", email)
            .get();
          for (const d of snaps.docs) {
            void d.ref.update("metadata.loginStatus", "failed");
          }
          const error = new Error(`Email failed to send to ${email}`);
          (error as Error & { cause: unknown }).cause = err;
          throw error;
        }
        const staffSnaps = await getFirestore()
          .collection("staff")
          .where("email", "==", email)
          .get();
        for (const d of staffSnaps.docs) {
          await d.ref.update("metadata.loginStatus", "awaiting_login");
        }
      };
      break;
    case "agency":
      callback = ({ email }) => emailProvider.sendAgencyRegistrationLink(email);
      break;
    case "client":
      callback = ({ email }) => emailProvider.sendClientRegistrationLink(email);
      break;
  }

  const result = await emailProvider.beginBatchEmailSend(emails, callback);

  return result;
});

export const assignStaffToAgency = onCall(async (request) => {
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

  const staffId = String(request.data?.staffId || "").trim();
  const agencyId = String(request.data?.agencyId || "").trim();

  logger.info("assignStaffToAgency called", { staffId, agencyId, callerUid });

  if (!staffId || !agencyId) {
    throw new HttpsError(
      "invalid-argument",
      "staffId and agencyId are required.",
    );
  }

  const agencySnap = await db.collection("agencies").doc(agencyId).get();
  if (!agencySnap.exists) {
    throw new HttpsError("not-found", "Agency not found.");
  }

  const agencyData = agencySnap.data()!;

  const assignedToName = getBusinessName(agencyData);

  const staffSnap = await db.collection("staff").doc(staffId).get();
  if (!staffSnap.exists) {
    throw new HttpsError("not-found", "Staff member not found.");
  }
  const refValue = getStaffRef(staffSnap.data()!);
  if (!refValue) {
    throw new HttpsError(
      "failed-precondition",
      "Staff record has no reference value.",
    );
  }

  await db
    .collection("staff")
    .doc(staffId)
    .set(
      {
        metadata: {
          assignedToId: agencyId,
          assignedToName,
          assignedAt: FieldValue.serverTimestamp(),
        },
      },
      { merge: true },
    );

  await db
    .collection("agencies")
    .doc(agencyId)
    .update({
      assignedStaff: FieldValue.delete(),
      "metadata.assignedStaff": FieldValue.arrayUnion(refValue),
    });

  return { ok: true, staffId, agencyId };
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
  const caller = callerSnap.data() as { role?: string; agencyId?: string };
  if (caller.role !== "admin" && caller.role !== "super") {
    throw new HttpsError("permission-denied", "Admin or Super only.");
  }

  const userRef = db.collection("users").doc(targetUserId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new HttpsError("not-found", "Target user not found.");
  }
  const target = userSnap.data() as { agencyId?: string };
  if (caller.role !== "super" && target.agencyId !== caller.agencyId) {
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
      const data = docSnap.data() as { fileName?: string };
      const fileName = String(data.fileName || "").trim();
      if (fileName) {
        const path = `contracts/unsigned/${targetUserId}/${fileName}`;
        await bucket.file(path).delete({ ignoreNotFound: true });
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
      const data = docSnap.data() as { fileName?: string };
      const fileName = String(data.fileName || "").trim();
      if (fileName) {
        const path = `contracts/signed/${targetUserId}/${fileName}`;
        await bucket.file(path).delete({ ignoreNotFound: true });
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
    { merge: true },
  );

  return { ok: true, targetUserId, mode };
});

export const bulkUploadStaff = onCall(async (request) => {
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

  const agencyId = String(request.data?.agencyId || "").trim();
  if (!agencyId) {
    throw new HttpsError("invalid-argument", "agencyId is required.");
  }

  const rows = request.data?.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new HttpsError("invalid-argument", "rows must be a non-empty array.");
  }

  const fileStoragePath = String(request.data?.fileStoragePath || "").trim();
  const originalFileName = String(request.data?.originalFileName || "").trim();

  const existingSnap = await db
    .collection("staff")
    .where("agencyId", "==", agencyId)
    .get();
  const existingEmails = new Set<string>();
  existingSnap.docs.forEach((d) => {
    const data = d.data() as { email?: string };
    if (data.email) existingEmails.add(data.email.toLowerCase());
  });

  let added = 0;
  let skipped = 0;
  const errors: string[] = [];

  let batch = db.batch();
  let batchCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const email = String(row.email || "")
      .trim()
      .toLowerCase();

    if (!email) {
      errors.push(`Row ${i + 1}: missing email, skipped.`);
      continue;
    }

    if (existingEmails.has(email)) {
      skipped++;
      continue;
    }

    let forename = String(
      row.forename || row.firstname || row.Forename || "",
    ).trim();
    let surname = String(
      row.surname || row.lastname || row.Surname || "",
    ).trim();
    const fullname = String(row.fullname || row.FullName || "").trim();
    const title = String(row.title || "").trim();

    if (fullname && !forename && !surname) {
      const firstSpace = fullname.indexOf(" ");
      if (firstSpace > 0) {
        forename = fullname.slice(0, firstSpace).trim();
        surname = fullname.slice(firstSpace + 1).trim();
      } else {
        forename = fullname;
      }
    }

    const docRef = db.collection("staff").doc();
    batch.set(docRef, {
      email,
      title,
      initial: String(row.initial || "").trim(),
      forename,
      surname,
      address1: String(row.address1 || "").trim(),
      address2: String(row.address2 || "").trim(),
      agencyId,
      metadata: {
        assignedBy: caller.email || callerUid,
        assignedAt: FieldValue.serverTimestamp(),
      },
      sourceFileName: originalFileName,
    });

    existingEmails.add(email);
    added++;
    batchCount++;

    if (batchCount >= 400) {
      await batch.commit();
      await delay(Number(DOCUMENT_UPLOAD_DELAY.value()));
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  await db.collection("uploads").add({
    fileName: originalFileName,
    fileStoragePath,
    uploadedBy: callerUid,
    uploadedAt: FieldValue.serverTimestamp(),
    agencyId,
    totalRows: rows.length,
    addedCount: added,
    skippedCount: skipped,
  });

  return { ok: true, added, skipped, errors };
});

export const removeAgencies = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Sign in required.");

  const db = getFirestore();
  const callerSnap = await db.collection("users").doc(callerUid).get();
  if (!callerSnap.exists) {
    throw new HttpsError("permission-denied", "Caller profile missing.");
  }

  const caller = callerSnap.data() as {
    role?: string;
    agencyId?: string;
  };
  if (caller.role !== "admin" && caller.role !== "super") {
    throw new HttpsError("permission-denied", "Admin or Super only.");
  }

  const importId = String(request.data?.importId || "").trim();
  if (!importId) {
    throw new HttpsError("invalid-argument", "importId is required.");
  }

  const importRef = db.collection("csv_imports").doc(importId);
  const importSnap = await importRef.get();
  if (!importSnap.exists) {
    throw new HttpsError("not-found", "Import record not found.");
  }

  const importData = importSnap.data() as {
    fileUrl?: string | null;
  };

  if (importData.fileUrl) {
    try {
      const filePath = decodeURIComponent(
        importData.fileUrl.split("/o/")[1]?.split("?")[0] ?? "",
      );
      if (filePath) {
        await getStorage().bucket().file(filePath).delete();
      }
    } catch {
      // file may not exist — proceed with record deletion
    }
  }

  const agencySnaps = await db
    .collection("agencies")
    .where("metadata.uploadedInFile", "==", importId)
    .get();

  const BATCH_LIMIT = 500;
  let deletedCount = 0;

  for (let i = 0; i < agencySnaps.docs.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    const chunk = agencySnaps.docs.slice(i, i + BATCH_LIMIT);
    for (const doc of chunk) {
      batch.delete(doc.ref);
      deletedCount++;
    }
    await batch.commit();
  }

  // Delete Auth users + users docs for imported agencies with email
  for (const snap of agencySnaps.docs) {
    const data = snap.data() as { email?: string };
    const email = data.email;
    if (!email || !emailPattern.test(email)) continue;
    await removeAuthUser(email);

    const userDocs = await db
      .collection("users")
      .where("email", "==", email.toLowerCase())
      .get();
    userDocs.forEach((doc) => doc.ref.delete());

    const loginEmail = data.email;
    if (loginEmail) {
      await db
        .collection("logins")
        .doc(loginEmail.toLowerCase())
        .delete()
        .catch(() => {});
    }
  }

  await importRef.delete();

  return { ok: true, deletedCount, importId };
});

export const assignAgencyToClient = onCall(async (request) => {
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

  const clientId = String(request.data?.clientId || "").trim();
  const assignedAgencyIds: string[] = Array.isArray(
    request.data?.assignedAgencyIds,
  )
    ? request.data.assignedAgencyIds.map(String)
    : [];

  if (!clientId) {
    throw new HttpsError("invalid-argument", "clientId is required.");
  }

  await db
    .collection("clients")
    .doc(clientId)
    .set(
      {
        metadata: {
          assignedAgencies: assignedAgencyIds,
        },
      },
      { merge: true },
    );

  // Sync assignedAgencyIds to the client's user doc so the Firestore
  // security rules can grant read access to the assigned agencies.
  const clientSnap = await db.collection("clients").doc(clientId).get();
  const clientData = clientSnap.data() as { email?: string } | undefined;
  if (clientData?.email) {
    const userQuery = await db
      .collection("users")
      .where("email", "==", clientData.email.toLowerCase())
      .where("role", "==", "admin")
      .limit(1)
      .get();
    if (!userQuery.empty) {
      await db
        .collection("users")
        .doc(userQuery.docs[0].id)
        .update({ assignedAgencyIds });
    }
  }

  return { ok: true, clientId, assignedAgencyIds };
});

export const removeClients = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Sign in required.");

  const db = getFirestore();
  const callerSnap = await db.collection("users").doc(callerUid).get();
  if (!callerSnap.exists) {
    throw new HttpsError("permission-denied", "Caller profile missing.");
  }

  const caller = callerSnap.data() as {
    role?: string;
    agencyId?: string;
  };
  if (caller.role !== "admin" && caller.role !== "super") {
    throw new HttpsError("permission-denied", "Admin or Super only.");
  }

  const importId = String(request.data?.importId || "").trim();
  if (!importId) {
    throw new HttpsError("invalid-argument", "importId is required.");
  }

  const importRef = db.collection("csv_imports").doc(importId);
  const importSnap = await importRef.get();
  if (!importSnap.exists) {
    throw new HttpsError("not-found", "Import record not found.");
  }

  const importData = importSnap.data() as {
    fileUrl?: string | null;
  };

  if (importData.fileUrl) {
    try {
      const filePath = decodeURIComponent(
        importData.fileUrl.split("/o/")[1]?.split("?")[0] ?? "",
      );
      if (filePath) {
        await getStorage().bucket().file(filePath).delete();
      }
    } catch {
      // file may not exist — proceed with record deletion
    }
  }

  const clientSnaps = await db
    .collection("clients")
    .where("metadata.uploadedInFile", "==", importId)
    .get();

  const BATCH_LIMIT = 500;
  let deletedCount = 0;

  for (let i = 0; i < clientSnaps.docs.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    const chunk = clientSnaps.docs.slice(i, i + BATCH_LIMIT);
    for (const doc of chunk) {
      batch.delete(doc.ref);
      deletedCount++;
    }
    await batch.commit();
  }

  // Delete Auth users + users docs for imported clients with email
  for (const snap of clientSnaps.docs) {
    const data = snap.data() as { email?: string };
    const email = data.email;
    if (!email || !emailPattern.test(email)) continue;
    await removeAuthUser(email);

    const userDocs = await db
      .collection("users")
      .where("email", "==", email.toLowerCase())
      .get();
    userDocs.forEach((doc) => doc.ref.delete());

    const loginEmail = data.email;
    if (loginEmail) {
      await db
        .collection("logins")
        .doc(loginEmail.toLowerCase())
        .delete()
        .catch(() => {});
    }
  }

  await importRef.delete();

  return { ok: true, deletedCount, importId };
});

export const removeStaffImport = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Sign in required.");

  const db = getFirestore();
  const callerSnap = await db.collection("users").doc(callerUid).get();
  if (!callerSnap.exists) {
    throw new HttpsError("permission-denied", "Caller profile missing.");
  }

  const caller = callerSnap.data() as {
    role?: string;
    agencyId?: string;
  };
  if (caller.role !== "super") {
    throw new HttpsError("permission-denied", "Super only.");
  }

  const importId = String(request.data?.importId || "").trim();
  if (!importId) {
    throw new HttpsError("invalid-argument", "importId is required.");
  }

  const importRef = db.collection("csv_imports").doc(importId);
  const importSnap = await importRef.get();
  if (!importSnap.exists) {
    throw new HttpsError("not-found", "Import record not found.");
  }

  const importData = importSnap.data() as {
    fileUrl?: string | null;
  };

  if (importData.fileUrl) {
    try {
      const filePath = decodeURIComponent(
        importData.fileUrl.split("/o/")[1]?.split("?")[0] ?? "",
      );
      if (filePath) {
        await getStorage().bucket().file(filePath).delete();
      }
    } catch {
      // file may not exist — proceed with record deletion
    }
  }

  const staffSnaps = await db
    .collection("staff")
    .where("metadata.uploadedInFile", "==", importId)
    .get();

  const agencyUpdates = new Map<string, string[]>();

  for (const snap of staffSnaps.docs) {
    const data = snap.data();
    const assignedToId = data.metadata?.assignedToId;
    if (assignedToId) {
      const ids = agencyUpdates.get(assignedToId) || [];
      const refValue = getStaffRef(data);
      if (refValue) ids.push(refValue);
      agencyUpdates.set(assignedToId, ids);
    }
  }

  const BATCH_LIMIT = 500;
  let deletedCount = 0;

  for (let i = 0; i < staffSnaps.docs.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    const chunk = staffSnaps.docs.slice(i, i + BATCH_LIMIT);
    for (const doc of chunk) {
      batch.delete(doc.ref);
      deletedCount++;
    }
    await batch.commit();
  }

  // Delete Auth users + users docs for staff members with email
  for (const snap of staffSnaps.docs) {
    const data = snap.data() as { email?: string };
    const email = data.email;
    if (!email || !emailPattern.test(email)) continue;
    await removeAuthUser(email);

    const userDocs = await db
      .collection("users")
      .where("email", "==", email.toLowerCase())
      .get();
    userDocs.forEach((doc) => doc.ref.delete());

    await db
      .collection("logins")
      .doc(email.toLowerCase())
      .delete()
      .catch(() => {});
  }

  for (const [agencyId, staffIds] of agencyUpdates) {
    await db
      .collection("agencies")
      .doc(agencyId)
      .update({
        "metadata.assignedStaff": FieldValue.arrayRemove(...staffIds),
      });
  }

  await importRef.delete();

  return {
    ok: true,
    deletedCount,
    importId,
    agencyCleanupCount: agencyUpdates.size,
  };
});

export const backfillAssignedBy = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Sign in required.");

  const db = getFirestore();
  const callerSnap = await db.collection("users").doc(callerUid).get();
  if (!callerSnap.exists) {
    throw new HttpsError("permission-denied", "Caller profile missing.");
  }

  const caller = callerSnap.data() as { role?: string; agencyId?: string };
  if (caller.role !== "admin" && caller.role !== "super") {
    throw new HttpsError("permission-denied", "Admin or Super only.");
  }

  const agencyId = caller.agencyId;
  if (!agencyId) {
    throw new HttpsError("failed-precondition", "Caller has no agencyId.");
  }

  const staffSnaps = await db
    .collection("staff")
    .where("metadata.assignedBy", "!=", "")
    .get();

  const uidToEmail = new Map<string, string>();
  const batch = db.batch();
  let updatedCount = 0;

  for (const snap of staffSnaps.docs) {
    const data = snap.data();
    const assignedBy = data.metadata?.assignedBy;
    if (!assignedBy || assignedBy.includes("@")) continue;

    if (!uidToEmail.has(assignedBy)) {
      try {
        const userRecord = await getAuth().getUser(assignedBy);
        uidToEmail.set(assignedBy, userRecord.email || assignedBy);
      } catch {
        uidToEmail.set(assignedBy, assignedBy);
      }
    }

    const resolvedEmail = uidToEmail.get(assignedBy);
    if (resolvedEmail && resolvedEmail !== assignedBy) {
      batch.update(snap.ref, "metadata.assignedBy", resolvedEmail);
      updatedCount++;
    }
  }

  if (updatedCount > 0) {
    await batch.commit();
  }

  return { ok: true, updatedCount };
});

export const unassignStaffFromAgency = onCall(async (request) => {
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

  const staffId = String(request.data?.staffId || "").trim();
  if (!staffId) {
    throw new HttpsError("invalid-argument", "staffId is required.");
  }

  logger.info("unassignStaffFromAgency called", { staffId, callerUid });

  const staffSnap = await db.collection("staff").doc(staffId).get();
  if (!staffSnap.exists) {
    throw new HttpsError("not-found", "Staff member not found.");
  }

  const staffData = staffSnap.data();
  const agencyId = staffData?.metadata?.assignedToId;
  logger.info("unassignStaffFromAgency staff data", {
    staffId,
    agencyId,
    hasMetadata: !!staffData?.metadata,
    metadataKeys: staffData?.metadata ? Object.keys(staffData.metadata) : [],
  });
  if (!agencyId) {
    throw new HttpsError("failed-precondition", "Staff not assigned.");
  }

  const refValue = getStaffRef(staffData);
  if (!refValue) {
    throw new HttpsError(
      "failed-precondition",
      "Staff record has no reference value.",
    );
  }

  await db
    .collection("staff")
    .doc(staffId)
    .set(
      {
        metadata: {
          assignedToId: FieldValue.delete(),
          assignedToName: FieldValue.delete(),
          assignedAt: FieldValue.delete(),
        },
      },
      { merge: true },
    );

  await db
    .collection("agencies")
    .doc(agencyId)
    .update({
      "metadata.assignedStaff": FieldValue.arrayRemove(refValue),
    });

  return { ok: true, staffId, agencyId };
});

export const addStaffTag = onCall(async (request) => {
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

  const staffId = String(request.data?.staffId || "").trim();
  const tag = String(request.data?.tag || "").trim();
  if (!staffId || !tag) {
    throw new HttpsError("invalid-argument", "staffId and tag are required.");
  }

  const tagsSnap = await db.collection("tags").where("value", "==", tag).get();
  let tagId: string;
  if (tagsSnap.empty) {
    const newTagRef = await db.collection("tags").add({ value: tag });
    tagId = newTagRef.id;
  } else {
    tagId = tagsSnap.docs[0].id;
  }

  await db
    .collection("staff")
    .doc(staffId)
    .update({
      tags: FieldValue.arrayUnion(tagId),
    });

  return { ok: true, staffId, tagId, tagValue: tag, created: tagsSnap.empty };
});

export const removeClientLogin = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Sign in required.");

  const uid = String(request.data?.uid || "").trim();
  if (!uid) throw new HttpsError("invalid-argument", "uid is required.");

  const db = getFirestore();
  const adminAuth = getAuth();

  const callerSnap = await db.collection("users").doc(callerUid).get();
  if (!callerSnap.exists) {
    throw new HttpsError("permission-denied", "Caller profile missing.");
  }

  const caller = callerSnap.data() as { role?: string; agencyId?: string };
  if (caller.role !== "admin" && caller.role !== "super") {
    throw new HttpsError("permission-denied", "Admin or Super only.");
  }
  if (!caller.agencyId && caller.role !== "super") {
    throw new HttpsError("failed-precondition", "Admin has no agencyId.");
  }

  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new HttpsError("not-found", "User not found.");

  const userData = userSnap.data() as {
    email?: string;
    agencyId?: string;
    role?: string;
    invitedByAgencyId?: string;
  };
  if (userData.role !== "client") {
    throw new HttpsError("permission-denied", "Can only remove client users.");
  }

  try {
    await adminAuth.deleteUser(uid);
  } catch (err: unknown) {
    const authErr = err as { code?: string };
    if (authErr.code !== "auth/user-not-found") throw err;
  }

  await userRef.delete();

  if (userData.email) {
    await db
      .collection("logins")
      .doc(userData.email.toLowerCase())
      .delete()
      .catch(() => {});
  }

  return { ok: true, uid };
});

export const uploadSignedContract = onCall(
  { maxInstances: 10 },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }

    const { fileBase64, fileName, clientId, contentType } = request.data;
    if (!fileBase64 || !fileName || !clientId) {
      throw new HttpsError(
        "invalid-argument",
        "Missing required fields: fileBase64, fileName, clientId",
      );
    }

    const bucket = getStorage().bucket();
    const filePath = `signed_contracts/${clientId}/${fileName}`;
    const fileRef = bucket.file(filePath);

    const token =
      Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    const buffer = Buffer.from(fileBase64, "base64");

    await fileRef.save(buffer, {
      metadata: {
        contentType: contentType ?? "application/pdf",
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });

    const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media&token=${token}`;

    await getFirestore().collection("agencies").doc(clientId).update({
      "metadata.signedContractName": fileName,
      "metadata.signedContract": downloadUrl,
      "metadata.signedContractAt": new Date().toISOString(),
    });

    return { ok: true, url: downloadUrl };
  },
);

export const deleteContract = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Sign in required.");

  const db = getFirestore();
  const callerSnap = await db.collection("users").doc(callerUid).get();
  if (!callerSnap.exists) {
    throw new HttpsError("permission-denied", "Caller profile missing.");
  }

  const caller = callerSnap.data() as { role?: string };
  if (caller.role !== "admin" && caller.role !== "super") {
    throw new HttpsError("permission-denied", "Admin or Super only.");
  }

  const clientId = String(request.data?.clientId || "").trim();
  if (!clientId) {
    throw new HttpsError("invalid-argument", "clientId is required.");
  }

  const clientRef = db.collection("agencies").doc(clientId);
  const clientSnap = await clientRef.get();
  if (!clientSnap.exists) {
    throw new HttpsError("not-found", "Client not found.");
  }

  const clientData = clientSnap.data() as {
    metadata?: {
      signedContract?: string;
      signedContractName?: string;
    };
  };

  if (clientData.metadata?.signedContract) {
    try {
      const filePath = decodeURIComponent(
        clientData.metadata.signedContract.split("/o/")[1]?.split("?")[0] ?? "",
      );
      if (filePath) {
        await getStorage().bucket().file(filePath).delete();
      }
    } catch {
      // file may not exist — proceed with clearing fields
    }
  }

  await clientRef.update({
    "metadata.signedContractName": FieldValue.delete(),
    "metadata.signedContract": FieldValue.delete(),
  });

  return { ok: true, clientId };
});

export const recordTimesheetUpload = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const { clientId, fileName, fileBase64, contentType } = request.data;
  console.log("[recordTimesheetUpload] received data:", {
    clientId,
    fileName,
    fileBase64Len: fileBase64?.length,
    hasContentType: !!contentType,
  });
  if (!clientId || !fileName || !fileBase64) {
    throw new HttpsError(
      "invalid-argument",
      "Missing required fields: clientId, fileName, fileBase64",
    );
  }

  const callerUid = request.auth.uid;
  const db = getFirestore();
  const callerSnap = await db.collection("users").doc(callerUid).get();
  if (!callerSnap.exists) {
    throw new HttpsError("not-found", "User profile not found.");
  }

  const callerData = callerSnap.data() as Record<string, unknown>;
  const callerEmail = (callerData.EMAIL ?? callerData.email ?? "") as string;
  const callerRole = (callerData.ROLE ?? callerData.role ?? "") as string;
  console.log("[recordTimesheetUpload] caller data:", {
    callerRole,
    callerEmail,
  });
  const uploadedBy = (request.auth.token?.email ?? callerEmail) || "unknown";

  if (callerRole !== "client") {
    throw new HttpsError(
      "permission-denied",
      "Only clients can upload timesheets.",
    );
  }

  const bucket = getStorage().bucket();
  const filePath = `timesheets/${clientId}/${fileName}`;
  const fileRef = bucket.file(filePath);

  console.log(`[recordTimesheetUpload] Checking: filePath=${filePath}`);

  const [fileExists] = await fileRef.exists();
  console.log(
    `[recordTimesheetUpload] fileRef.exists() returned: ${fileExists}`,
  );

  if (!fileExists) {
    const [files] = await bucket.getFiles({
      prefix: `timesheets/${clientId}/`,
    });
    const existingNames = files.map((f) => f.name);
    console.log(
      `[recordTimesheetUpload] Files in timesheets/${clientId}/:`,
      JSON.stringify(existingNames),
    );
    console.log(
      `[recordTimesheetUpload] Looking for: timesheets/${clientId}/${fileName}`,
    );
    const match = existingNames.find(
      (n) => n === `timesheets/${clientId}/${fileName}`,
    );
    console.log(
      `[recordTimesheetUpload] Manual match result: ${match ?? "none"}`,
    );
  }

  if (fileExists) {
    throw new HttpsError(
      "already-exists",
      `A timesheet named "${fileName}" has already been uploaded.`,
    );
  }

  const token =
    Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const buffer = Buffer.from(fileBase64, "base64");

  try {
    await fileRef.save(buffer, {
      metadata: {
        contentType: contentType ?? "application/pdf",
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });
  } catch {
    throw new HttpsError(
      "internal",
      "Failed to save file to storage. The timesheet has not been uploaded.",
    );
  }

  const fileUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media&token=${token}`;

  const entry = {
    uploadedBy,
    uploadedAt: new Date().toISOString(),
    fileName,
    fileUrl,
    hasSeen: false,
    hasDownloaded: false,
  };

  await db
    .collection("agencies")
    .doc(clientId)
    .update({
      "metadata.timesheets": FieldValue.arrayUnion(entry),
    });

  return { ok: true, url: fileUrl };
});

export const seenItems = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const { type, ids, agencyId } = request.data as {
    type?: string;
    ids?: string[];
    agencyId?: string;
  };

  if (!type || !Array.isArray(ids) || ids.length === 0 || !agencyId) {
    throw new HttpsError(
      "invalid-argument",
      "type, a non-empty ids array, and agencyId are required.",
    );
  }

  if (type !== "invoices" && type !== "timesheets") {
    throw new HttpsError(
      "invalid-argument",
      "type must be 'invoices' or 'timesheets'.",
    );
  }

  const db = getFirestore();

  const isInvoices = type === "invoices";
  const fieldPath = isInvoices ? "metadata.invoices" : "metadata.timesheets";
  const idKey = isInvoices ? "id" : "fileName";
  const collection = isInvoices ? "clients" : "agencies";

  const idSet = new Set(ids);
  const snap = await db.collection(collection).doc(agencyId).get();

  if (!snap.exists) {
    throw new HttpsError("not-found", "Document not found.");
  }

  const data = snap.data() as Record<string, unknown> | undefined;
  const meta = data?.metadata as Record<string, unknown> | undefined;
  const items = (meta?.[type] as Array<Record<string, unknown>>) ?? [];

  const updated = items.map((item) => {
    if (idSet.has(String(item[idKey] ?? ""))) {
      return { ...item, hasSeen: true };
    }
    return item;
  });

  await db
    .collection(collection)
    .doc(agencyId)
    .update({ [fieldPath]: updated });

  return { ok: true };
});

export const setDownloaded = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const { type, agencyId, ids } = request.data as {
    type?: string;
    agencyId?: string;
    ids?: string[];
  };

  if (!type || !agencyId || !Array.isArray(ids) || ids.length === 0) {
    throw new HttpsError(
      "invalid-argument",
      "type, agencyId, and a non-empty ids array are required.",
    );
  }

  if (type !== "invoices" && type !== "timesheets") {
    throw new HttpsError(
      "invalid-argument",
      "type must be 'invoices' or 'timesheets'.",
    );
  }

  const db = getFirestore();
  const isInvoices = type === "invoices";
  const fieldPath = isInvoices ? "metadata.invoices" : "metadata.timesheets";
  const idKey = isInvoices ? "id" : "fileName";
  const collection = isInvoices ? "clients" : "agencies";
  const idSet = new Set(ids);

  const snap = await db.collection(collection).doc(agencyId).get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Document not found.");
  }

  const data = snap.data() as Record<string, unknown> | undefined;
  const meta = data?.metadata as Record<string, unknown> | undefined;
  const items = (meta?.[type] as Array<Record<string, unknown>>) ?? [];

  const updated = items.map((item) => {
    if (idSet.has(String(item[idKey] ?? ""))) {
      return { ...item, hasSeen: true, hasDownloaded: true };
    }
    return item;
  });

  await db
    .collection(collection)
    .doc(agencyId)
    .update({ [fieldPath]: updated });

  return { ok: true };
});

export const deleteTimesheet = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const { clientId, fileName } = request.data;
  if (!clientId || !fileName) {
    throw new HttpsError(
      "invalid-argument",
      "Missing required fields: clientId, fileName",
    );
  }

  const callerUid = request.auth.uid;
  const db = getFirestore();
  const callerSnap = await db.collection("users").doc(callerUid).get();
  if (!callerSnap.exists) {
    throw new HttpsError("not-found", "User profile not found.");
  }

  const callerData = callerSnap.data() as { role?: string };
  if (callerData.role !== "super") {
    throw new HttpsError("permission-denied", "Super admin only.");
  }

  const storagePath = `timesheets/${clientId}/${fileName}`;
  try {
    await getStorage().bucket().file(storagePath).delete();
  } catch {
    // file may not exist — proceed with clearing the entry
  }

  const agencyRef = db.collection("agencies").doc(clientId);
  const agencySnap = await agencyRef.get();
  if (!agencySnap.exists) {
    throw new HttpsError("not-found", "Client not found.");
  }

  const data = agencySnap.data() as {
    metadata?: { timesheets?: Array<Record<string, unknown>> };
  };
  const current = data.metadata?.timesheets ?? [];

  await agencyRef.update({
    "metadata.timesheets": current.filter((t) => t.fileName !== fileName),
  });

  return { ok: true };
});

export const uploadStaffCvs = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const { cvs } = request.data as {
    cvs: Array<{ staffId: string; fileName: string; fileBase64: string }>;
  };
  if (!cvs || !Array.isArray(cvs) || cvs.length === 0) {
    throw new HttpsError(
      "invalid-argument",
      "Missing required field: cvs (non-empty array)",
    );
  }

  const callerUid = request.auth.uid;
  const db = getFirestore();
  const callerSnap = await db.collection("users").doc(callerUid).get();
  if (!callerSnap.exists) {
    throw new HttpsError("not-found", "User profile not found.");
  }

  const callerData = callerSnap.data() as { email?: string; role?: string };
  if (callerData.role !== "super") {
    throw new HttpsError("permission-denied", "Super only.");
  }

  const uploadedBy = request.auth.token?.email ?? callerData.email ?? "unknown";
  const bucket = getStorage().bucket();
  const results: Array<{
    staffId: string;
    fileName: string;
    success: boolean;
    error?: string;
  }> = [];

  for (const { staffId, fileName, fileBase64 } of cvs) {
    try {
      const staffSnap = await db.collection("staff").doc(staffId).get();
      if (!staffSnap.exists) {
        results.push({
          staffId,
          fileName,
          success: false,
          error: "Staff not found",
        });
        continue;
      }

      const filePath = `cvs/${staffId}/${fileName}`;
      const fileRef = bucket.file(filePath);

      const [exists] = await fileRef.exists();
      if (exists) {
        results.push({
          staffId,
          fileName,
          success: false,
          error: "CV already exists",
        });
        continue;
      }

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

      const entry = {
        fileName,
        fileUrl,
        uploadedBy,
        uploadedAt: new Date().toISOString(),
      };

      await db
        .collection("staff")
        .doc(staffId)
        .update({
          "metadata.cv": FieldValue.arrayUnion(entry),
        });

      results.push({ staffId, fileName, success: true });
    } catch (err) {
      results.push({ staffId, fileName, success: false, error: String(err) });
    }
  }

  return { ok: true, results };
});

export const deleteStaffCv = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const { staffId, fileName } = request.data as {
    staffId: string;
    fileName: string;
  };
  if (!staffId || !fileName) {
    throw new HttpsError(
      "invalid-argument",
      "Missing required fields: staffId, fileName",
    );
  }

  const callerUid = request.auth.uid;
  const db = getFirestore();
  const callerSnap = await db.collection("users").doc(callerUid).get();
  if (!callerSnap.exists) {
    throw new HttpsError("not-found", "User profile not found.");
  }

  const callerData = callerSnap.data() as { role?: string };
  if (callerData.role !== "super") {
    throw new HttpsError("permission-denied", "Super only.");
  }

  const storagePath = `cvs/${staffId}/${fileName}`;
  try {
    await getStorage().bucket().file(storagePath).delete();
  } catch {
    // file may not exist — proceed with clearing the entry
  }

  const staffRef = db.collection("staff").doc(staffId);
  const staffSnap = await staffRef.get();
  if (!staffSnap.exists) {
    throw new HttpsError("not-found", "Staff not found.");
  }

  const data = staffSnap.data() as {
    metadata?: { cv?: Array<Record<string, unknown>> };
  };
  const current = data.metadata?.cv ?? [];

  await staffRef.update({
    "metadata.cv": current.filter((e) => e.fileName !== fileName),
  });

  return { ok: true };
});

/**
 * Uploads a document for a staff member, stores it in Cloud Storage,
 * updates the staff Firestore document, and sends a document-upload
 * notification email.
 *
 * @param request.data.staffId    - Firestore document ID of the staff record.
 * @param request.data.fileName   - Original filename.
 * @param request.data.fileBase64 - Base64-encoded file content.
 * @returns `{ ok: true, staffId: string, fileName: string }` on success.
 * @throws {HttpsError} "unauthenticated" if not signed in.
 * @throws {HttpsError} "invalid-argument" if required fields are missing.
 */
export const uploadStaffDocument = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const { staffId, fileName, fileBase64 } = request.data as {
    staffId: string;
    fileName: string;
    fileBase64: string;
  };
  if (!staffId || !fileName || !fileBase64) {
    throw new HttpsError(
      "invalid-argument",
      "Missing required fields: staffId, fileName, fileBase64",
    );
  }

  const callerUid = request.auth.uid;
  const db = getFirestore();
  const callerSnap = await db.collection("users").doc(callerUid).get();
  if (!callerSnap.exists) {
    throw new HttpsError("not-found", "User profile not found.");
  }

  const callerData = callerSnap.data() as { email?: string; role?: string };
  if (callerData.role !== "super") {
    throw new HttpsError("permission-denied", "Super only.");
  }

  const staffSnap = await db.collection("staff").doc(staffId).get();
  if (!staffSnap.exists) {
    throw new HttpsError("not-found", "Staff not found.");
  }

  const uploadedBy = request.auth.token?.email ?? callerData.email ?? "unknown";
  const bucket = getStorage().bucket();
  const filePath = `documents/${staffId}/${fileName}`;
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

  const entry = {
    fileName,
    fileUrl,
    uploadedBy,
    uploadedAt: new Date().toISOString(),
  };

  await db
    .collection("staff")
    .doc(staffId)
    .update({
      "metadata.documents": FieldValue.arrayUnion(entry),
    });

  const staffEmail = (staffSnap.data() as { email?: string })?.email;
  if (staffEmail) {
    const emailProvider = new EmailProvider();
    await emailProvider.sendDocumentEmail(staffEmail);
  }

  return { ok: true, staffId, fileName };
});

export const deleteStaffDocument = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const { staffId, fileName } = request.data as {
    staffId: string;
    fileName: string;
  };
  if (!staffId || !fileName) {
    throw new HttpsError(
      "invalid-argument",
      "Missing required fields: staffId, fileName",
    );
  }

  const callerUid = request.auth.uid;
  const db = getFirestore();
  const callerSnap = await db.collection("users").doc(callerUid).get();
  if (!callerSnap.exists) {
    throw new HttpsError("not-found", "User profile not found.");
  }

  const callerData = callerSnap.data() as { role?: string };
  if (callerData.role !== "super") {
    throw new HttpsError("permission-denied", "Super only.");
  }

  const storagePath = `documents/${staffId}/${fileName}`;
  try {
    await getStorage().bucket().file(storagePath).delete();
  } catch {
    // file may not exist — proceed with clearing the entry
  }

  const staffRef = db.collection("staff").doc(staffId);
  const staffSnap = await staffRef.get();
  if (!staffSnap.exists) {
    throw new HttpsError("not-found", "Staff not found.");
  }

  const data = staffSnap.data() as {
    metadata?: { documents?: Array<Record<string, unknown>> };
  };
  const current = data.metadata?.documents ?? [];

  await staffRef.update({
    "metadata.documents": current.filter((e) => e.fileName !== fileName),
  });

  return { ok: true };
});

export const removeStaffMember = onCall(async (request) => {
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

  const staffId = String(request.data?.staffId || "").trim();
  if (!staffId) {
    throw new HttpsError("invalid-argument", "staffId is required.");
  }

  const staffRef = db.collection("staff").doc(staffId);
  const staffSnap = await staffRef.get();
  if (!staffSnap.exists) {
    throw new HttpsError("not-found", "Staff member not found.");
  }

  const staffData = staffSnap.data() as {
    email?: string;
    metadata?: { assignedToId?: string };
  };

  // Remove from agency assignedStaff if assigned
  const assignedToId = staffData.metadata?.assignedToId;
  if (assignedToId) {
    const refValue = getStaffRef(staffData);
    if (refValue) {
      await db
        .collection("agencies")
        .doc(assignedToId)
        .update({
          "metadata.assignedStaff": FieldValue.arrayRemove(refValue),
        });
    }
  }

  // Delete Auth user + users doc by email
  const email = staffData.email;
  if (email && emailPattern.test(email)) {
    await removeAuthUser(email);

    const userDocs = await db
      .collection("users")
      .where("email", "==", email.toLowerCase())
      .get();
    userDocs.forEach((doc) => doc.ref.delete());

    await db
      .collection("logins")
      .doc(email.toLowerCase())
      .delete()
      .catch(() => {});
  }

  // Delete staff document
  await staffRef.delete();

  return { ok: true, staffId };
});

const getAlgoliaClient = () =>
  algoliasearch(ALGOLIA_APP_ID.value(), ALGOLIA_ADMIN_API_KEY.value());

const algoliaIndex = (name: string) => `${ALGOLIA_INDEX_PREFIX.value()}${name}`;

// ── Agencies → agencies index ──
export const syncAgencyToAlgolia = onDocumentWritten(
  { document: "agencies/{docId}", maxInstances: 10 },
  async (event) => {
    const client = getAlgoliaClient();
    const snap = event.data;
    if (!snap) return;

    if (!snap.after.exists) {
      await client.deleteObject({
        indexName: algoliaIndex("agencies"),
        objectID: event.params.docId,
      });
      console.log(`Deleted agency ${event.params.docId} from agencies index`);
      return;
    }

    const data = snap.after.data();
    if (!data) return;
    const sortableName = getBusinessName(data).toLowerCase().trim();

    await client.saveObject({
      indexName: algoliaIndex("agencies"),
      body: { objectID: event.params.docId, ...data, sortableName },
    });
    console.log(`Saved agency ${event.params.docId} to agencies index`);
  },
);

// ── Clients → clients index ──
export const syncClientsToAlgolia = onDocumentWritten(
  { document: "clients/{docId}", maxInstances: 10 },
  async (event) => {
    const client = getAlgoliaClient();
    const snap = event.data;
    if (!snap) return;

    if (!snap.after.exists) {
      await client.deleteObject({
        indexName: algoliaIndex("clients"),
        objectID: event.params.docId,
      });
      console.log(`Deleted client ${event.params.docId} from clients index`);
      return;
    }

    const data = snap.after.data();
    if (!data) return;
    const sortableName = getBusinessName(data).toLowerCase().trim();

    await client.saveObject({
      indexName: algoliaIndex("clients"),
      body: { objectID: event.params.docId, ...data, sortableName },
    });
    console.log(`Saved client ${event.params.docId} to clients index`);
  },
);

// ── Staff → staff index ──
export const syncStaffToAlgolia = onDocumentWritten(
  { document: "staff/{docId}", maxInstances: 10 },
  async (event) => {
    const client = getAlgoliaClient();
    const snap = event.data;
    if (!snap) return;

    if (!snap.after.exists) {
      await client.deleteObject({
        indexName: algoliaIndex("staff"),
        objectID: event.params.docId,
      });
      console.log(`Deleted staff ${event.params.docId} from staff index`);
      return;
    }

    const data = snap.after.data();
    const sortableName = (
      [data?.Forename, data?.Surname].filter(Boolean).join(" ") ||
      data?.FullName ||
      data?.email ||
      ""
    ).toLowerCase();

    const payslipsCount = (data?.metadata?.payslipsSent as string[] | undefined)?.length ?? 0;
    const metadata = { ...(data?.metadata as Record<string, unknown>), payslipsCount };

    await client.saveObject({
      indexName: algoliaIndex("staff"),
      body: { objectID: event.params.docId, ...data, sortableName, metadata },
    });
    console.log(`Saved staff ${event.params.docId} to staff index`);
  },
);

// ── Users → logins index (only role=client) ──
export const syncClientUserToAlgolia = onDocumentWritten(
  { document: "users/{docId}", maxInstances: 10 },
  async (event) => {
    const client = getAlgoliaClient();
    const snap = event.data;
    if (!snap) return;

    const wasClient =
      snap.before.exists && snap.before.data()?.role === "client";
    const isClient = snap.after.exists && snap.after.data()?.role === "client";

    if (!isClient && !wasClient) return;

    if (!isClient && wasClient) {
      await client.deleteObject({
        indexName: algoliaIndex("logins"),
        objectID: event.params.docId,
      });
      console.log(
        "Deleted user" +
          ` ${event.params.docId} from logins index (no longer client)`,
      );
      return;
    }

    const data = snap.after.data();
    if (!data) return;
    const sortableEmail = (data.email ?? "").toLowerCase();
    await client.saveObject({
      indexName: algoliaIndex("logins"),
      body: {
        objectID: event.params.docId,
        ...data,
        invitedByAgencyId: data.invitedByAgencyId ?? "",
        assignedTo: data.agencyId ?? "",
        sortableEmail,
      },
    });
    console.log(`Saved user ${event.params.docId} to logins index`);
  },
);

export const backfillAlgoliaIndices = onCall(
  { maxInstances: 1, timeoutSeconds: 540 },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }

    const client = getAlgoliaClient();
    const db = getFirestore();
    let totalStaff = 0;
    let totalAgencies = 0;
    let totalClients = 0;
    let totalLogins = 0;

    // ── Staff ──
    const staffSnap = await db.collection("staff").get();
    const staffObjects: Array<Record<string, unknown>> = [];
    for (const doc of staffSnap.docs) {
      const data = doc.data();
      const sortableName = (
        [data?.Forename, data?.Surname].filter(Boolean).join(" ") ||
        data?.FullName ||
        data?.email ||
        ""
      ).toLowerCase();
      staffObjects.push({ objectID: doc.id, ...data, sortableName });
    }
    if (staffObjects.length > 0) {
      await client.saveObjects({
        indexName: algoliaIndex("staff"),
        objects: staffObjects,
      });
      totalStaff = staffObjects.length;
    }

    // ── Agencies (agencies index) ──
    const agencySnap = await db.collection("agencies").get();
    const agencyObjects: Array<Record<string, unknown>> = [];
    for (const doc of agencySnap.docs) {
      const data = doc.data();
      const sortableName = getBusinessName(data ?? {})
        .toLowerCase()
        .trim();
      agencyObjects.push({ objectID: doc.id, ...data, sortableName });
    }
    if (agencyObjects.length > 0) {
      await client.saveObjects({
        indexName: algoliaIndex("agencies"),
        objects: agencyObjects,
      });
      totalAgencies = agencyObjects.length;
    }

    // ── Clients (clients index) ──
    const clientSnap = await db.collection("clients").get();
    const clientObjects: Array<Record<string, unknown>> = [];
    for (const doc of clientSnap.docs) {
      const data = doc.data();
      const sortableName = getBusinessName(data ?? {})
        .toLowerCase()
        .trim();
      clientObjects.push({ objectID: doc.id, ...data, sortableName });
    }
    if (clientObjects.length > 0) {
      await client.saveObjects({
        indexName: algoliaIndex("clients"),
        objects: clientObjects,
      });
      totalClients = clientObjects.length;
    }

    // ── Users / logins (role=client) ──
    const loginSnap = await db
      .collection("users")
      .where("role", "==", "client")
      .get();
    const loginObjects: Array<Record<string, unknown>> = [];
    for (const doc of loginSnap.docs) {
      const data = doc.data();
      const sortableEmail = (data.email ?? "").toLowerCase();
      loginObjects.push({
        objectID: doc.id,
        ...data,
        invitedByAgencyId: data.invitedByAgencyId ?? "",
        assignedTo: data.agencyId ?? "",
        sortableEmail,
      });
    }
    if (loginObjects.length > 0) {
      await client.saveObjects({
        indexName: algoliaIndex("logins"),
        objects: loginObjects,
      });
      totalLogins = loginObjects.length;
    }

    return {
      ok: true,
      staffBackfilled: totalStaff,
      agenciesBackfilled: totalAgencies,
      clientsBackfilled: totalClients,
      loginsBackfilled: totalLogins,
    };
  },
);

export const uploadInvoice = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const {
    fileBase64,
    fileName,
    agencyId,
    contentType,
    dueDate,
    amountPayable,
    agencyName,
  } = request.data;
  if (!fileBase64 || !fileName || !agencyId) {
    throw new HttpsError(
      "invalid-argument",
      "Missing required fields: fileBase64, fileName, agencyId",
    );
  }
  if (!dueDate || !amountPayable) {
    throw new HttpsError(
      "invalid-argument",
      "dueDate and amountPayable are required.",
    );
  }

  const callerUid = request.auth.uid;
  const db = getFirestore();
  const callerSnap = await db.collection("users").doc(callerUid).get();
  if (!callerSnap.exists) {
    throw new HttpsError("not-found", "User profile not found.");
  }

  const callerData = callerSnap.data() as {
    email?: string;
    role?: string;
  };
  if (callerData.role !== "super") {
    throw new HttpsError("permission-denied", "Super only.");
  }
  const uploadedBy = request.auth.token?.email ?? callerData.email ?? "unknown";

  const clientSnap = await db.collection("clients").doc(agencyId).get();
  if (clientSnap.exists) {
    const clientData = clientSnap.data() as {
      metadata?: { invoices?: Array<{ fileName?: string }> };
    };
    const existing = clientData.metadata?.invoices ?? [];
    if (existing.some((inv) => inv.fileName === fileName)) {
      throw new HttpsError(
        "already-exists",
        `An invoice named "${fileName}" already exists.`,
      );
    }
  }

  const bucket = getStorage().bucket();
  const filePath = `invoices/${agencyId}/${fileName}`;
  const fileRef = bucket.file(filePath);

  const token =
    Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const buffer = Buffer.from(fileBase64, "base64");

  try {
    await fileRef.save(buffer, {
      metadata: {
        contentType: contentType ?? "application/pdf",
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });
  } catch {
    throw new HttpsError("internal", "Failed to save file to storage.");
  }

  const fileUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media&token=${token}`;

  const entry = {
    id: filePath,
    fileName,
    fileUrl,
    agencyId,
    uploadedBy,
    uploadedByUid: callerUid,
    uploadedAt: new Date().toISOString(),
    dueDate,
    amountPayable,
    agencyName: agencyName ?? "",
    status: "unpaid",
    hasSeen: false,
    hasDownloaded: false,
  };

  await db
    .collection("clients")
    .doc(agencyId)
    .set(
      { metadata: { invoices: FieldValue.arrayUnion(entry) } },
      { merge: true },
    );

  return { ok: true, url: fileUrl };
});

export const markInvoicePaid = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const callerUid = request.auth.uid;
  const db = getFirestore();
  const callerSnap = await db.collection("users").doc(callerUid).get();
  if (!callerSnap.exists) {
    throw new HttpsError("not-found", "User profile not found.");
  }

  const callerData = callerSnap.data() as { role?: string };
  if (callerData.role !== "admin" && callerData.role !== "super") {
    throw new HttpsError("permission-denied", "Admin or Super only.");
  }

  const agencyId = String(request.data?.agencyId || "").trim();
  const invoiceId = String(request.data?.invoiceId || "").trim();
  if (!agencyId || !invoiceId) {
    throw new HttpsError(
      "invalid-argument",
      "agencyId and invoiceId are required.",
    );
  }

  const clientRef = db.collection("clients").doc(agencyId);
  const clientSnap = await clientRef.get();
  if (!clientSnap.exists) {
    throw new HttpsError("not-found", "Client not found.");
  }

  const data = clientSnap.data() as {
    metadata?: { invoices?: Array<Record<string, unknown>> };
  };
  const current = data.metadata?.invoices ?? [];

  const updated = current.map((inv) => {
    if (inv.id === invoiceId || inv.fileName === invoiceId) {
      return {
        ...inv,
        status: "paid",
        paidAt: new Date().toISOString(),
        paidBy: callerUid,
      };
    }
    return inv;
  });

  await clientRef.update({
    "metadata.invoices": updated,
  });

  return { ok: true };
});

export const deleteInvoice = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const callerUid = request.auth.uid;
  const db = getFirestore();
  const callerSnap = await db.collection("users").doc(callerUid).get();
  if (!callerSnap.exists) {
    throw new HttpsError("not-found", "User profile not found.");
  }

  const callerData = callerSnap.data() as { role?: string };
  if (callerData.role !== "admin" && callerData.role !== "super") {
    throw new HttpsError("permission-denied", "Admin or Super only.");
  }

  const agencyId = String(request.data?.agencyId || "").trim();
  const invoiceId = String(request.data?.invoiceId || "").trim();
  if (!agencyId || !invoiceId) {
    throw new HttpsError(
      "invalid-argument",
      "agencyId and invoiceId are required.",
    );
  }

  const clientRef = db.collection("clients").doc(agencyId);
  const clientSnap = await clientRef.get();
  if (!clientSnap.exists) {
    throw new HttpsError("not-found", "Client not found.");
  }

  const data = clientSnap.data() as {
    metadata?: { invoices?: Array<Record<string, unknown>> };
  };
  const current = data.metadata?.invoices ?? [];

  const target = current.find(
    (inv) =>
      (inv.id as string) === invoiceId ||
      (inv.fileName as string) === invoiceId,
  );

  if (target) {
    const filePath = String(target.id || "");
    if (filePath) {
      try {
        await getStorage().bucket().file(filePath).delete();
      } catch {
        // file may not exist — proceed with record removal
      }
    }
  }

  const updated = current.filter(
    (inv) =>
      (inv.id as string) !== invoiceId &&
      (inv.fileName as string) !== invoiceId,
  );

  await clientRef.update({
    "metadata.invoices": updated,
  });

  return { ok: true };
});

export const getMaintenanceWindow = onCall(async () => {
  const db = getFirestore();
  const snap = await db.collection("maintenance").doc("config").get();

  if (!snap.exists) {
    return { show: false };
  }

  const data = snap.data();
  if (!data?.show) {
    return { show: false };
  }

  return {
    show: true,
    start: data.start?.toMillis() ?? null,
    end: data.end?.toMillis() ?? null,
  };
});

export const deletePayslip = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const { payslipId, staffId } = request.data as {
    payslipId?: string;
    staffId?: string;
  };
  if (!payslipId || !staffId) {
    throw new HttpsError(
      "invalid-argument",
      "payslipId and staffId are required.",
    );
  }

  const callerUid = request.auth.uid;
  const db = getFirestore();

  const callerSnap = await db.collection("users").doc(callerUid).get();
  if (!callerSnap.exists) {
    throw new HttpsError("not-found", "User profile not found.");
  }

  const callerData = callerSnap.data() as { role?: string; agencyId?: string };
  if (callerData.role !== "super" && callerData.role !== "admin") {
    throw new HttpsError("permission-denied", "Super or admin only.");
  }

  const payslipSnap = await db.collection("payslips").doc(payslipId).get();
  if (!payslipSnap.exists) {
    throw new HttpsError("not-found", "Payslip not found.");
  }

  const payslipData = payslipSnap.data() as {
    userId?: string;
    fileName?: string;
    agencyId?: string;
  };

  if (
    callerData.role !== "super" &&
    payslipData.agencyId !== callerData.agencyId
  ) {
    throw new HttpsError(
      "permission-denied",
      "Cannot delete payslips from another agency.",
    );
  }

  const targetUserId = payslipData.userId ?? staffId;
  const fileName = payslipData.fileName ?? "";
  if (fileName) {
    try {
      await getStorage()
        .bucket()
        .file(`payslips/${targetUserId}/${fileName}`)
        .delete();
    } catch {
      // file may not exist — proceed with document cleanup
    }
  }

  await db.collection("payslips").doc(payslipId).delete();

  const staffRef = db.collection("staff").doc(targetUserId);
  const staffSnap = await staffRef.get();
  if (staffSnap.exists) {
    const staffData = staffSnap.data() as {
      metadata?: { payslipsSent?: string[] };
    };
    const existing = staffData?.metadata?.payslipsSent ?? [];
    const newPayslipsSent = existing.filter((id) => id !== payslipId);
    await staffRef.set(
      {
        metadata: {
          payslipsSent: newPayslipsSent,
          payslipsCount: newPayslipsSent.length,
        },
      },
      { merge: true },
    );
  }

  return { ok: true };
});

export const updateLoginStatus = onCall(
  { region: "europe-west2" },
  async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid)
      throw new HttpsError("unauthenticated", "Sign in required.");

    const { email, status } = request.data as {
      email?: string;
      status?: string;
    };

    if (!email || !status) {
      throw new HttpsError(
        "invalid-argument",
        "email and status are required.",
      );
    }

    const validStatuses = ["awaiting_login", "password_set", "logged_in"];
    if (!validStatuses.includes(status)) {
      throw new HttpsError(
        "invalid-argument",
        `status must be one of: ${validStatuses.join(", ")}`,
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    console.log(
      `[updateLoginStatus] Request: email="${normalizedEmail}", status="${status}"`,
    );
    console.log(
      `[updateLoginStatus] Looking up staff by email: "${normalizedEmail}"`,
    );

    const staffSnaps = await getFirestore()
      .collection("staff")
      .where("email", "==", normalizedEmail)
      .get();

    console.log(`[updateLoginStatus] Found ${staffSnaps.size} staff docs`);

    if (staffSnaps.empty) {
      console.warn(
        `[updateLoginStatus] No staff doc found for email: "${normalizedEmail}"`,
      );
    }

    for (const d of staffSnaps.docs) {
      const docData = d.data();
      console.log(
        `[updateLoginStatus] Staff doc ${d.id}: email="${docData.email}", ` +
          `Forename="${docData.Forename}", Surname="${docData.Surname}"`,
      );
      console.log(
        `[updateLoginStatus] Updating staff doc ${d.id} → loginStatus: "${status}"`,
      );
      await d.ref.update("metadata.loginStatus", status);
    }

    return { ok: true, loginStatus: status };
  },
);
