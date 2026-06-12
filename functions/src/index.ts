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
setGlobalOptions({ maxInstances: 10, region: "europe-west2" });

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

import { onCall, HttpsError } from "firebase-functions/v2/https";

import { defineString } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

initializeApp();

const WEB_API_KEY = defineString("WEB_API_KEY");
const RESET_CONTINUE_URL = defineString("RESET_CONTINUE_URL"); // e.g. http://localhost:5173/login

const normalizeEmail = (value: unknown): string =>
  String(value || "")
    .trim()
    .toLowerCase();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const namePattern = /^[A-Za-z' -]+$/;

const normalizeKey = (key: string): string =>
  key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

const NI_NORMALIZED_VARIANTS = new Set([
  "ninumber",
  "nino",
  "nationalinsurancenumber",
  "nationalinsuranceno",
  "nationalinsurance",
  "nin",
  "ni",
  "natinsnumber",
  "natinsno",
  "natins",
  "nationalins",
  "ninsurance",
  "insurance",
  "ssn",
  "socialsecuritynumber",
  "nidentifier",
  "nationalid",
  "natid",
  "niid",
]);

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

const getNINumber = (row: Record<string, unknown>): string => {
  for (const [key, value] of Object.entries(row)) {
    if (NI_NORMALIZED_VARIANTS.has(normalizeKey(key))) {
      return String(value ?? "");
    }
  }
  return "";
};

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
      agencyId: caller.agencyId,
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
      agencyId: caller.agencyId,
      invitedByAgencyId: caller.agencyId,
      invitedByUid: callerUid,
      invitedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  // Triggers Firebase password-reset email template
  // (used as set-password invite).
  const continueUrl = String(
    request.data?.continueUrl || RESET_CONTINUE_URL.value(),
  );

  const resp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${WEB_API_KEY.value()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestType: "PASSWORD_RESET",
        email,
        continueUrl,
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
      "Failed to send invite email: " + `${resp.status} `,
    );
  }

  return { ok: true, userId: user.uid };
});

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
  if (caller.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin only.");
  }
  if (!caller.agencyId) {
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

  await db.collection("users").doc(user.uid).set(
    {
      uid: user.uid,
      email,
      role: "client",
      agencyId: agencyDocId,
      invitedByAgencyId: caller.agencyId,
      invitedByUid: callerUid,
      invitedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  const continueUrl = String(
    request.data?.continueUrl || RESET_CONTINUE_URL.value(),
  );

  const resp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${WEB_API_KEY.value()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestType: "PASSWORD_RESET",
        email,
        continueUrl,
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
      "Failed to send invite email: " + `${resp.status} `,
    );
  }

  return { ok: true, userId: user.uid };
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
  if (caller.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin only.");
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

  const agenciesRef = db.collection("agencies");
  const [oldSnaps, newSnaps] = await Promise.all([
    agenciesRef.where("importedByAgencyId", "==", caller.agencyId).get(),
    agenciesRef.where("metadata.uploadedBy", "==", caller.agencyId).get(),
  ]);

  const docSeen = new Set<string>();
  const existingNames = new Set<string>();
  for (const doc of [...oldSnaps.docs, ...newSnaps.docs]) {
    if (docSeen.has(doc.id)) continue;
    docSeen.add(doc.id);
    const data = doc.data();
    const name = getBusinessName(data).toLowerCase().trim();
    if (name) existingNames.add(name);
  }

  const newRecords: Array<Record<string, unknown>> = [];
  let duplicateCount = 0;

  for (const record of records) {
    if (typeof record !== "object" || record === null) continue;
    const name = getBusinessName(record).toLowerCase().trim();
    if (name && existingNames.has(name)) {
      duplicateCount++;
      continue;
    }
    newRecords.push(record);
  }

  if (newRecords.length === 0) {
    return {
      ok: true,
      added: 0,
      duplicates: duplicateCount,
      total: records.length,
    };
  }

  const importRef = db.collection("csv_imports").doc();
  const importId = importRef.id;

  const BATCH_LIMIT = 500;
  let writtenCount = 0;

  for (let i = 0; i < newRecords.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    const chunk = newRecords.slice(i, i + BATCH_LIMIT);
    for (const record of chunk) {
      const docRef = db.collection("agencies").doc();
      batch.set(docRef, {
        ...record,
        metadata: {
          uploadedInFile: importId,
          uploadedBy: caller.agencyId,
          importedAt: FieldValue.serverTimestamp(),
        },
      });
    }
    await batch.commit();
    writtenCount += chunk.length;
  }

  const totalRecords = Number(request.data?.totalRecords) || records.length;

  await importRef.set({
    type: "agency",
    agencyId: caller.agencyId,
    fileName,
    fileUrl: fileUrl || null,
    recordCount: newRecords.length,
    totalRecords,
    importedByUid: callerUid,
    importedByEmail: caller.email ?? null,
    importedAt: FieldValue.serverTimestamp(),
  });

  return {
    ok: true,
    added: writtenCount,
    duplicates: duplicateCount,
    total: records.length,
    importId,
  };
});

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
  if (caller.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin only.");
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

  const staffRef = db.collection("staff");
  const [oldSnaps, newSnaps] = await Promise.all([
    staffRef.where("agencyId", "==", caller.agencyId).get(),
    staffRef.where("metadata.uploadedBy", "==", caller.agencyId).get(),
  ]);

  const docSeen = new Set<string>();
  const existingNiNumbers = new Set<string>();
  for (const doc of [...oldSnaps.docs, ...newSnaps.docs]) {
    if (docSeen.has(doc.id)) continue;
    docSeen.add(doc.id);
    const data = doc.data();
    const ni = getNINumber(data).toLowerCase();
    if (ni) existingNiNumbers.add(ni);
  }

  let assignedToId = request.data?.assignedToId
    ? String(request.data.assignedToId)
    : null;
  const assignedToNameInput = request.data?.assignedToName
    ? String(request.data.assignedToName)
    : null;

  if (!assignedToId) {
    assignedToId = caller.agencyId ?? null;
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

  const newRecords: Array<Record<string, unknown>> = [];
  let duplicateCount = 0;

  for (const record of records) {
    if (typeof record !== "object" || record === null) continue;
    const ni = getNINumber(record).toLowerCase();
    if (ni && existingNiNumbers.has(ni)) {
      duplicateCount++;
      continue;
    }
    existingNiNumbers.add(ni);

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

    newRecords.push(record);
  }

  if (newRecords.length === 0) {
    return {
      ok: true,
      added: 0,
      duplicates: duplicateCount,
      total: records.length,
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
      const docRef = db.collection("staff").doc();
      batch.set(docRef, {
        ...record,
        ...(tagIds && tagIds.length > 0 ? { tags: tagIds } : {}),
        metadata: {
          uploadedInFile: importId,
          uploadedBy: caller.agencyId,
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
      newStaffIds.push(docRef.id);
    }
    await batch.commit();
    writtenCount += chunk.length;
  }

  if (assignedToId && newStaffIds.length > 0) {
    await db
      .collection("agencies")
      .doc(assignedToId)
      .update({
        assignedStaff: FieldValue.arrayUnion(...newStaffIds),
      });
  }

  const totalRecords = Number(request.data?.totalRecords) || records.length;

  await importRef.set({
    type: "staff",
    agencyId: caller.agencyId,
    fileName,
    fileUrl: fileUrl || null,
    recordCount: newRecords.length,
    totalRecords,
    importedByUid: callerUid,
    importedByEmail: caller.email ?? null,
    importedAt: FieldValue.serverTimestamp(),
  });

  return {
    ok: true,
    added: writtenCount,
    duplicates: duplicateCount,
    total: records.length,
    importId,
  };
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
  if (caller.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin only.");
  }

  const staffId = String(request.data?.staffId || "").trim();
  const assignedToId = String(request.data?.assignedToId || "").trim();
  const assignedToName = String(request.data?.assignedToName || "").trim();

  if (!staffId || !assignedToId || !assignedToName) {
    throw new HttpsError(
      "invalid-argument",
      "staffId, assignedToId, and assignedToName are required.",
    );
  }

  await db
    .collection("staff")
    .doc(staffId)
    .set(
      {
        metadata: {
          assignedToId,
          assignedToName,
          assignedBy: caller.email ?? callerUid,
          assignedAt: FieldValue.serverTimestamp(),
        },
      },
      { merge: true },
    );

  await db
    .collection("agencies")
    .doc(assignedToId)
    .update({
      assignedStaff: FieldValue.arrayUnion(staffId),
    });

  return { ok: true, staffId, assignedToId };
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
  if (caller.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin only.");
  }

  const userRef = db.collection("users").doc(targetUserId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new HttpsError("not-found", "Target user not found.");
  }
  const target = userSnap.data() as { agencyId?: string };
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
  if (caller.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin only.");
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
      Forename: forename,
      Surname: surname,
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
  if (caller.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin only.");
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

  const agencyIds = agencySnaps.docs.map((d) => d.id);

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

  // Remove associated client logins
  const adminAuth = getAuth();
  for (const agencyId of agencyIds) {
    const userSnaps = await db
      .collection("users")
      .where("agencyId", "==", agencyId)
      .where("role", "==", "client")
      .get();
    for (const userDoc of userSnaps.docs) {
      try {
        await adminAuth.deleteUser(userDoc.id);
      } catch (err: unknown) {
        const authErr = err as { code?: string };
        if (authErr.code !== "auth/user-not-found") throw err;
      }
      await userDoc.ref.delete();
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
  if (caller.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin only.");
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
      ids.push(snap.id);
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

  for (const [agencyId, staffIds] of agencyUpdates) {
    await db
      .collection("agencies")
      .doc(agencyId)
      .update({
        assignedStaff: FieldValue.arrayRemove(...staffIds),
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
  if (caller.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin only.");
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
  if (caller.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin only.");
  }

  const staffId = String(request.data?.staffId || "").trim();
  if (!staffId) {
    throw new HttpsError("invalid-argument", "staffId is required.");
  }

  const staffSnap = await db.collection("staff").doc(staffId).get();
  if (!staffSnap.exists) {
    throw new HttpsError("not-found", "Staff member not found.");
  }

  const staffData = staffSnap.data();
  const assignedToId = staffData?.metadata?.assignedToId;
  if (!assignedToId) {
    throw new HttpsError("failed-precondition", "Staff not assigned.");
  }

  await db
    .collection("staff")
    .doc(staffId)
    .set(
      {
        metadata: {
          assignedToId: FieldValue.delete(),
          assignedToName: FieldValue.delete(),
          assignedBy: FieldValue.delete(),
          assignedAt: FieldValue.delete(),
        },
      },
      { merge: true },
    );

  await db
    .collection("agencies")
    .doc(assignedToId)
    .update({
      assignedStaff: FieldValue.arrayRemove(staffId),
    });

  return { ok: true, staffId, assignedToId };
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
  if (caller.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin only.");
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
  if (caller.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin only.");
  }
  if (!caller.agencyId) {
    throw new HttpsError("failed-precondition", "Admin has no agencyId.");
  }

  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new HttpsError("not-found", "User not found.");

  const userData = userSnap.data() as {
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
      "metadata.signedContractAt": FieldValue.serverTimestamp(),
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
  if (caller.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin only.");
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

  const callerData = callerSnap.data() as {
    email?: string;
    agencyId?: string;
    role?: string;
  };
  const uploadedBy = request.auth.token?.email ?? callerData.email ?? "unknown";

  if (callerData.role === "client" && callerData.agencyId !== clientId) {
    throw new HttpsError(
      "permission-denied",
      "Cannot upload timesheet for another client.",
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
  };

  await db
    .collection("agencies")
    .doc(clientId)
    .update({
      "metadata.timesheets": FieldValue.arrayUnion(entry),
    });

  return { ok: true, url: fileUrl };
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
  if (callerData.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin only.");
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
  if (callerData.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin only.");
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
  if (callerData.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin only.");
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

import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { algoliasearch } from "algoliasearch";

const ALGOLIA_APP_ID = defineString("ALGOLIA_APP_ID");
const ALGOLIA_ADMIN_API_KEY = defineString("ALGOLIA_ADMIN_API_KEY");
const ALGOLIA_INDEX_PREFIX = defineString("ALGOLIA_INDEX_PREFIX");

const getAlgoliaClient = () =>
  algoliasearch(ALGOLIA_APP_ID.value(), ALGOLIA_ADMIN_API_KEY.value());

const algoliaIndex = (name: string) => `${ALGOLIA_INDEX_PREFIX.value()}${name}`;

// ── Agencies → clients index ──
export const syncAgencyToAlgolia = onDocumentWritten(
  { document: "agencies/{docId}", maxInstances: 10 },
  async (event) => {
    const client = getAlgoliaClient();
    const snap = event.data;
    if (!snap) return;

    if (!snap.after.exists) {
      await client.deleteObject({
        indexName: algoliaIndex("clients"),
        objectID: event.params.docId,
      });
      console.log(`Deleted agency ${event.params.docId} from clients index`);
      return;
    }

    const data = snap.after.data();
    if (!data) return;
    const sortableName = getBusinessName(data).toLowerCase().trim();

    await client.saveObject({
      indexName: algoliaIndex("clients"),
      body: { objectID: event.params.docId, ...data, sortableName },
    });
    console.log(`Saved agency ${event.params.docId} to clients index`);
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

    await client.saveObject({
      indexName: algoliaIndex("staff"),
      body: { objectID: event.params.docId, ...data, sortableName },
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

    // ── Agencies (clients index) ──
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
        indexName: algoliaIndex("clients"),
        objects: agencyObjects,
      });
      totalAgencies = agencyObjects.length;
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
  const uploadedBy = request.auth.token?.email ?? callerData.email ?? "unknown";

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
  };

  await db
    .collection("agencies")
    .doc(agencyId)
    .update({
      "metadata.invoices": FieldValue.arrayUnion(entry),
    });

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
  if (callerData.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin only.");
  }

  const agencyId = String(request.data?.agencyId || "").trim();
  const invoiceId = String(request.data?.invoiceId || "").trim();
  if (!agencyId || !invoiceId) {
    throw new HttpsError(
      "invalid-argument",
      "agencyId and invoiceId are required.",
    );
  }

  const agencyRef = db.collection("agencies").doc(agencyId);
  const agencySnap = await agencyRef.get();
  if (!agencySnap.exists) {
    throw new HttpsError("not-found", "Agency not found.");
  }

  const data = agencySnap.data() as {
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

  await agencyRef.update({
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
  if (callerData.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin only.");
  }

  const agencyId = String(request.data?.agencyId || "").trim();
  const invoiceId = String(request.data?.invoiceId || "").trim();
  if (!agencyId || !invoiceId) {
    throw new HttpsError(
      "invalid-argument",
      "agencyId and invoiceId are required.",
    );
  }

  const agencyRef = db.collection("agencies").doc(agencyId);
  const agencySnap = await agencyRef.get();
  if (!agencySnap.exists) {
    throw new HttpsError("not-found", "Agency not found.");
  }

  const data = agencySnap.data() as {
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

  await agencyRef.update({
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
