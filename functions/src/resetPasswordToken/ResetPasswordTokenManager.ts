import crypto from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import type { Auth } from "firebase-admin/auth";
import type { PasswordResetDoc } from "./types";
import { logger } from "firebase-functions";

const MIN_PASSWORD_LENGTH = 6;
const DEFAULT_EXPIRY_HOURS = 120;
const TOKEN_BYTES = 32;

export class ResetPasswordTokenManager {
  /**
   * @param db           - Admin Firestore instance
   * @param auth         - Admin Auth instance (getAuth())
   * @param resetPageUrl - Base URL of the reset page,
   *                       e.g. "https://portal.com/reset-password"
   */
  constructor(
    private readonly db: Firestore,
    private readonly auth: Auth,
    private readonly resetPageUrl: string,
  ) {}

  /**
   * Generates a secure random token, persists it to Firestore, and returns
   * the raw token string.
   *
   * **One-active-token enforcement:** any existing unexpired tokens for
   * this user are deleted before the new one is created. This ensures
   * no user ever has more than one valid reset link at a time.
   *
   * @param email         - Verified email of the user requesting reset.
   * @param expiryInHours - Hours until the token expires (default 48).
   * @returns The raw 64-char hex token.
   * @throws Error("EMAIL_NOT_FOUND") if no Firebase Auth user exists.
   * @throws Error("EMAIL_REQUIRED") if email is empty.
   */
  async createToken(
    email: string,
    expiryInHours: number = DEFAULT_EXPIRY_HOURS,
  ): Promise<string> {
    if (!email) {
      logger.error("[ResetPasswordTokenManager] createToken: empty email");
      throw new Error("EMAIL_REQUIRED");
    }

    logger.info("[ResetPasswordTokenManager] createToken: looking up user", {
      email,
    });

    let userRecord;
    try {
      userRecord = await this.auth.getUserByEmail(email);
    } catch (err) {
      logger.error("[ResetPasswordTokenManager] createToken: user not found", {
        email,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    logger.info("[ResetPasswordTokenManager] createToken: user found", {
      uid: userRecord.uid,
    });

    try {
      await this.invalidateExistingTokens(userRecord.uid);
    } catch (err) {
      logger.error(
        "[ResetPasswordTokenManager] createToken: invalidateExistingTokens failed",
        {
          uid: userRecord.uid,
          error: err instanceof Error ? err.message : String(err),
        },
      );
      throw err;
    }

    const token = crypto.randomBytes(TOKEN_BYTES).toString("hex");
    const expiresAt = Timestamp.fromDate(
      new Date(Date.now() + expiryInHours * 60 * 60 * 1000),
    );

    try {
      await this.db
        .collection("passwordResets")
        .doc(token)
        .set({
          uid: userRecord.uid,
          email,
          expiresAt,
          createdAt: FieldValue.serverTimestamp(),
        } satisfies PasswordResetDoc & {
          createdAt: ReturnType<typeof FieldValue.serverTimestamp>;
        });
    } catch (err) {
      logger.error(
        "[ResetPasswordTokenManager] createToken: firestore write failed",
        {
          email,
          uid: userRecord.uid,
          error: err instanceof Error ? err.message : String(err),
        },
      );
      throw err;
    }

    logger.info("[ResetPasswordTokenManager] createToken: token created", {
      uid: userRecord.uid,
      email,
      token: `${token.substring(0, 8)}...`,
    });

    return token;
  }

  /**
   * High-level helper that creates a token and returns the full reset URL.
   *
   * @param email         - Verified email of the user requesting reset.
   * @param expiryInHours - Hours until the token expires (default 24).
   * @returns Full URL like "https://portal.com/reset-password?token=<hex>".
   */
  async getResetLink(
    email: string,
    expiryInHours: number = DEFAULT_EXPIRY_HOURS,
  ): Promise<string> {
    logger.info("[ResetPasswordTokenManager] getResetLink", { email });
    const token = await this.createToken(email, expiryInHours);
    const url = `${this.resetPageUrl}?token=${token}`;
    logger.info("[ResetPasswordTokenManager] getResetLink: link generated", {
      email,
    });
    return url;
  }

  /**
   * Validates a reset token and updates the user's password via Admin SDK.
   *
   * Checks performed (in order):
   * 1. Token document exists in `passwordResets` collection.
   * 2. Token has not expired (`expiresAt > now`).
   * 3. New password meets minimum length (6 chars).
   *
   * On success the token document is deleted and the user's refresh
   * tokens are revoked (forces re-login on all devices).
   *
   * @param token       - The 64-char hex token from the reset URL.
   * @param newPassword - The new password to set (min 6 chars).
   * @returns Object containing the user's uid and email.
   * @throws Error("INVALID_TOKEN") if token document doesn't exist.
   * @throws Error("TOKEN_EXPIRED") if token has passed its expiry.
   * @throws Error("INVALID_PASSWORD") if password is too short.
   */
  async completeReset(
    token: string,
    newPassword: string,
  ): Promise<{ uid: string; email: string }> {
    logger.info("[ResetPasswordTokenManager] completeReset: starting", {
      token: `${token.substring(0, 8)}...`,
    });

    if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
      logger.error(
        "[ResetPasswordTokenManager] completeReset: password too short",
      );
      throw new Error("INVALID_PASSWORD");
    }

    const tokenRef = this.db.collection("passwordResets").doc(token);
    const doc = await tokenRef.get();

    if (!doc.exists) {
      logger.error(
        "[ResetPasswordTokenManager] completeReset: token not found",
        {
          token: `${token.substring(0, 8)}...`,
        },
      );
      throw new Error("INVALID_TOKEN");
    }

    const data = doc.data() as PasswordResetDoc | undefined;
    if (!data) {
      logger.error(
        "[ResetPasswordTokenManager] completeReset: token doc has no data",
        {
          token: `${token.substring(0, 8)}...`,
        },
      );
      throw new Error("INVALID_TOKEN");
    }

    if (Timestamp.now().seconds >= data.expiresAt.seconds) {
      logger.error("[ResetPasswordTokenManager] completeReset: token expired", {
        uid: data.uid,
        email: data.email,
      });
      await tokenRef.delete();
      throw new Error("TOKEN_EXPIRED");
    }

    logger.info(
      "[ResetPasswordTokenManager] completeReset: token valid, updating password",
      {
        uid: data.uid,
        email: data.email,
      },
    );

    try {
      await this.auth.updateUser(data.uid, { password: newPassword });
      await tokenRef.delete();
    } catch (err) {
      logger.error(
        "[ResetPasswordTokenManager] completeReset: updateUser failed",
        {
          uid: data.uid,
          error: err instanceof Error ? err.message : String(err),
        },
      );
      throw err;
    }

    await this.auth.revokeRefreshTokens(data.uid);

    try {
      await tokenRef.delete();
    } catch (err) {
      logger.error(
        "[ResetPasswordTokenManager] completeReset: failed to delete token",
        {
          uid: data.uid,
          token: `${token.substring(0, 8)}...`,
          error: err instanceof Error ? err.message : String(err),
        },
      );
      throw err;
    }

    logger.info(
      "[ResetPasswordTokenManager] completeReset: password updated and token deleted",
      {
        uid: data.uid,
        email: data.email,
      },
    );

    return { uid: data.uid, email: data.email };
  }

  /**
   * Validates that a token exists and has not expired.
   *
   * Intended to be called before the user submits the reset form, allowing
   * the client to redirect immediately if the token is invalid.
   *
   * @param token - The 64-char hex token from the reset URL.
   * @returns `{ valid: true }` if token is valid, otherwise
   *          `{ valid: false, reason }` with one of:
   *          `"INVALID_TOKEN"`, `"TOKEN_EXPIRED"`.
   */
  async validateToken(
    token: string,
  ): Promise<{ valid: true } | { valid: false; reason: string }> {
    if (!token) {
      logger.warn(
        "[ResetPasswordTokenManager] validateToken: no token provided",
      );
      return { valid: false, reason: "INVALID_TOKEN" };
    }

    const doc = await this.db.collection("passwordResets").doc(token).get();

    if (!doc.exists) {
      logger.warn(
        "[ResetPasswordTokenManager] validateToken: token not found",
        {
          token: `${token.substring(0, 8)}...`,
        },
      );
      return { valid: false, reason: "INVALID_TOKEN" };
    }

    const data = doc.data() as PasswordResetDoc | undefined;
    if (!data) {
      logger.warn(
        "[ResetPasswordTokenManager] validateToken: token doc empty",
        {
          token: `${token.substring(0, 8)}...`,
        },
      );
      return { valid: false, reason: "INVALID_TOKEN" };
    }

    if (Timestamp.now().seconds >= data.expiresAt.seconds) {
      logger.warn("[ResetPasswordTokenManager] validateToken: token expired", {
        uid: data.uid,
        email: data.email,
      });
      try {
        await this.db.collection("passwordResets").doc(token).delete();
      } catch {
        // best-effort cleanup
      }
      return { valid: false, reason: "TOKEN_EXPIRED" };
    }

    logger.info("[ResetPasswordTokenManager] validateToken: token valid", {
      uid: data.uid,
      email: data.email,
    });

    return { valid: true };
  }

  /**
   * Batch-deletes all password reset documents where `expiresAt` is in
   * the past. Intended for a scheduled (cron) cloud function.
   *
   * @returns Number of deleted documents.
   */
  async cleanupExpired(): Promise<number> {
    const snapshot = await this.db
      .collection("passwordResets")
      .where("expiresAt", "<", Timestamp.now())
      .get();

    if (snapshot.empty) {
      return 0;
    }

    const batch = this.db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    logger.info(
      "[ResetPasswordTokenManager] cleanupExpired: deleted expired tokens",
      {
        count: snapshot.size,
      },
    );

    return snapshot.size;
  }

  /**
   * Deletes all unexpired tokens for the given UID.
   * Called before creating a new token to enforce the
   * one-active-token-per-user invariant.
   */
  private async invalidateExistingTokens(uid: string): Promise<void> {
    const snapshot = await this.db
      .collection("passwordResets")
      .where("uid", "==", uid)
      .where("expiresAt", ">=", Timestamp.now())
      .get();

    if (snapshot.empty) {
      return;
    }

    const batch = this.db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    logger.info(
      "[ResetPasswordTokenManager] invalidateExistingTokens: deleted old tokens",
      {
        uid,
        count: snapshot.size,
      },
    );
  }
}
