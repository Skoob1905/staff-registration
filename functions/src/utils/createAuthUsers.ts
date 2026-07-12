import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

export interface CreateAuthUserEntry {
  email: string;
  uid: string;
}

export interface CreateAuthUsersMetadata {
  role: string;
  agencyId: string;
  invitedByUid: string;
}

/**
 * Creates Firebase Auth users for the given emails if they do not already
 * exist, and writes corresponding documents to the `users` and
 * `unregistered_staff` Firestore collections so that the user can
 * complete registration and has a loadable profile on sign-in.
 *
 * @param emails   - Array of email addresses to provision.
 * @param metadata - Role, agency, and inviter context for the new docs.
 * @returns Array of `{ email, uid }` for each successfully confirmed user.
 */
export async function createAuthUsers(
  emails: string[],
  metadata: CreateAuthUsersMetadata,
): Promise<CreateAuthUserEntry[]> {
  const adminAuth = getAuth();
  const db = getFirestore();
  const confirmed: CreateAuthUserEntry[] = [];

  for (const email of emails) {
    let uid: string | undefined;

    try {
      const existing = await adminAuth.getUserByEmail(email);
      uid = existing.uid;
    } catch (err: unknown) {
      const authErr = err as { code?: string };
      if (authErr.code === "auth/user-not-found") {
        try {
          const created = await adminAuth.createUser({ email });
          uid = created.uid;
        } catch (createErr: unknown) {
          logger.error("[createAuthUsers] Failed to create user", {
            email,
            error:
              createErr instanceof Error
                ? createErr.message
                : String(createErr),
          });
          continue;
        }
      } else {
        logger.error("[createAuthUsers] Failed to look up user", {
          email,
          error: err instanceof Error ? err.message : String(err),
        });
        continue;
      }
    }

    if (!uid) continue;

    const userDoc = {
      uid,
      email,
      role: metadata.role,
      registered: true,
      metadata: {
        invitedByAgencyId: metadata.agencyId,
        invitedByUid: metadata.invitedByUid,
        invitedAt: FieldValue.serverTimestamp(),
      },
    };

    try {
      await db.collection("users").doc(uid).set(userDoc, { merge: true });
      confirmed.push({ email, uid });
    } catch (writeErr: unknown) {
      logger.error("[createAuthUsers] Failed to write Firestore docs", {
        email,
        uid,
        error: writeErr instanceof Error ? writeErr.message : String(writeErr),
      });
    }
  }

  return confirmed;
}
