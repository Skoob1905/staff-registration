import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

export interface CreateAuthUserEntry {
  email: string;
  uid: string;
}

export interface CreateAuthUserInput {
  email: string;
  role: string;
  agencyId: string;
  invitedByUid: string;
}

/**
 * Creates Firebase Auth users for the given emails if they do not already
 * exist, and writes corresponding documents to the `users` Firestore
 * collection so that the user has a loadable profile on sign-in.
 *
 * @param entries - Per-user metadata (email, role, agencyId, inviter).
 * @returns Array of `{ email, uid }` for each successfully confirmed user.
 */
export async function createAuthUsers(
  entries: CreateAuthUserInput[],
): Promise<CreateAuthUserEntry[]> {
  const adminAuth = getAuth();
  const db = getFirestore();
  const confirmed: CreateAuthUserEntry[] = [];

  for (const entry of entries) {
    let uid: string | undefined;

    try {
      const existing = await adminAuth.getUserByEmail(entry.email);
      uid = existing.uid;
    } catch (err: unknown) {
      const authErr = err as { code?: string };
      if (authErr.code === "auth/user-not-found") {
        try {
          const created = await adminAuth.createUser({ email: entry.email });
          uid = created.uid;
        } catch (createErr: unknown) {
          logger.error("[createAuthUsers] Failed to create user", {
            email: entry.email,
            error:
              createErr instanceof Error
                ? createErr.message
                : String(createErr),
          });
          continue;
        }
      } else {
        logger.error("[createAuthUsers] Failed to look up user", {
          email: entry.email,
          error: err instanceof Error ? err.message : String(err),
        });
        continue;
      }
    }

    if (!uid) continue;

    const userDoc = {
      uid,
      email: entry.email,
      role: entry.role,
      agencyId: entry.agencyId,
      registered: true,
      metadata: {
        invitedByAgencyId: entry.agencyId,
        invitedByUid: entry.invitedByUid,
        invitedAt: FieldValue.serverTimestamp(),
      },
    };

    try {
      await db.collection("users").doc(uid).set(userDoc, { merge: true });
      confirmed.push({ email: entry.email, uid });
    } catch (writeErr: unknown) {
      logger.error("[createAuthUsers] Failed to write Firestore docs", {
        email: entry.email,
        uid,
        error:
          writeErr instanceof Error ? writeErr.message : String(writeErr),
      });
    }
  }

  return confirmed;
}
