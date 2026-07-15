import crypto from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import type { Auth } from "firebase-admin/auth";
import type { PasswordResetDoc } from "./types";

const MIN_PASSWORD_LENGTH = 6;
const DEFAULT_EXPIRY_HOURS = 24;
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
   * **One-active-token enforcement:** if the user already has any active
   * (unused + unexpired) reset tokens, they are marked as `used: true`
   * before the new token is created. This ensures no user ever has more
   * than one valid reset link at a time.
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
      throw new Error("EMAIL_REQUIRED");
    }

    const userRecord = await this.auth.getUserByEmail(email);

    await this.invalidateExistingTokens(userRecord.uid);

    const token = crypto.randomBytes(TOKEN_BYTES).toString("hex");
    const expiresAt = Timestamp.fromDate(
      new Date(Date.now() + expiryInHours * 60 * 60 * 1000),
    );

    await this.db
      .collection("passwordResets")
      .doc(token)
      .set({
        uid: userRecord.uid,
        email,
        expiresAt,
        used: false,
        createdAt: FieldValue.serverTimestamp(),
      } satisfies PasswordResetDoc & {
        createdAt: ReturnType<typeof FieldValue.serverTimestamp>;
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
    const token = await this.createToken(email, expiryInHours);
    return `${this.resetPageUrl}?token=${token}`;
  }

  /**
   * Validates a reset token and updates the user's password via Admin SDK.
   *
   * Checks performed (in order):
   * 1. Token document exists in `passwordResets` collection.
   * 2. Token has not already been used (`used === false`).
   * 3. Token has not expired (`expiresAt > now`).
   * 4. New password meets minimum length (6 chars).
   *
   * On success the token is marked `used: true` and the user's refresh
   * tokens are revoked (forces re-login on all devices).
   *
   * @param token       - The 64-char hex token from the reset URL.
   * @param newPassword - The new password to set (min 6 chars).
   * @returns Object containing the user's uid and email.
   * @throws Error("INVALID_TOKEN") if token document doesn't exist.
   * @throws Error("TOKEN_ALREADY_USED") if token was already consumed.
   * @throws Error("TOKEN_EXPIRED") if token has passed its expiry.
   * @throws Error("INVALID_PASSWORD") if password is too short.
   */
  async completeReset(
    token: string,
    newPassword: string,
  ): Promise<{ uid: string; email: string }> {
    if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new Error("INVALID_PASSWORD");
    }

    const tokenRef = this.db.collection("passwordResets").doc(token);
    const doc = await tokenRef.get();

    if (!doc.exists) {
      throw new Error("INVALID_TOKEN");
    }

    const data = doc.data() as PasswordResetDoc | undefined;
    if (!data) {
      throw new Error("INVALID_TOKEN");
    }

    if (data.used) {
      throw new Error("TOKEN_ALREADY_USED");
    }

    if (Timestamp.now().seconds >= data.expiresAt.seconds) {
      throw new Error("TOKEN_EXPIRED");
    }

    await this.auth.updateUser(data.uid, { password: newPassword });
    await this.auth.revokeRefreshTokens(data.uid);
    await tokenRef.update({ used: true });

    return { uid: data.uid, email: data.email };
  }

  /**
   * Validates that a token exists, has not been used, and has not expired.
   *
   * Intended to be called before the user submits the reset form, allowing
   * the client to redirect immediately if the token is invalid.
   *
   * @param token - The 64-char hex token from the reset URL.
   * @returns `{ valid: true }` if token is valid, otherwise
   *          `{ valid: false, reason }` with one of:
   *          `"INVALID_TOKEN"`, `"TOKEN_ALREADY_USED"`, `"TOKEN_EXPIRED"`.
   */
  async validateToken(
    token: string,
  ): Promise<{ valid: true } | { valid: false; reason: string }> {
    if (!token) {
      return { valid: false, reason: "INVALID_TOKEN" };
    }

    const doc = await this.db.collection("passwordResets").doc(token).get();

    if (!doc.exists) {
      return { valid: false, reason: "INVALID_TOKEN" };
    }

    const data = doc.data() as PasswordResetDoc | undefined;
    if (!data) {
      return { valid: false, reason: "INVALID_TOKEN" };
    }

    if (data.used) {
      return { valid: false, reason: "TOKEN_ALREADY_USED" };
    }

    if (Timestamp.now().seconds >= data.expiresAt.seconds) {
      return { valid: false, reason: "TOKEN_EXPIRED" };
    }

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

    return snapshot.size;
  }

  /**
   * Deletes all active (unused + unexpired) tokens for the given UID.
   * This is called before creating a new token to enforce the
   * one-active-token-per-user invariant — old tokens are fully removed
   * rather than marked used.
   */
  private async invalidateExistingTokens(uid: string): Promise<void> {
    const snapshot = await this.db
      .collection("passwordResets")
      .where("uid", "==", uid)
      .where("used", "==", false)
      .where("expiresAt", ">=", Timestamp.now())
      .get();

    if (snapshot.empty) {
      return;
    }

    const batch = this.db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
}
