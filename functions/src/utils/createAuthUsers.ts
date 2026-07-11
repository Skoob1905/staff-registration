import { getAuth } from "firebase-admin/auth";
import * as logger from "firebase-functions/logger";

export async function createAuthUsers(emails: string[]): Promise<string[]> {
  const adminAuth = getAuth();
  const confirmed: string[] = [];

  for (const email of emails) {
    try {
      await adminAuth.getUserByEmail(email);
      confirmed.push(email);
    } catch (err: unknown) {
      const authErr = err as { code?: string };
      if (authErr.code === "auth/user-not-found") {
        try {
          await adminAuth.createUser({ email });
          confirmed.push(email);
        } catch (createErr: unknown) {
          logger.error("[createAuthUsers] Failed to create user", {
            email,
            error: createErr instanceof Error ? createErr.message : String(createErr),
          });
        }
      } else {
        logger.error("[createAuthUsers] Failed to look up user", {
          email,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return confirmed;
}
