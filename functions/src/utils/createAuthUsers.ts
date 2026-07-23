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

async function runWithConcurrency<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  concurrency = 20,
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

export async function createAuthUsers(
  entries: CreateAuthUserInput[],
): Promise<CreateAuthUserEntry[]> {
  const adminAuth = getAuth();
  const db = getFirestore();
  const confirmed: CreateAuthUserEntry[] = [];

  const processEntry = async (entry: CreateAuthUserInput) => {
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
          return;
        }
      } else {
        logger.error("[createAuthUsers] Failed to look up user", {
          email: entry.email,
          error: err instanceof Error ? err.message : String(err),
        });
        return;
      }
    }

    if (!uid) return;

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
  };

  await runWithConcurrency(entries, processEntry, 20);

  return confirmed;
}
