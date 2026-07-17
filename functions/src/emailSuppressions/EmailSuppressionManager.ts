import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import type { Sender, SuppressionReason } from "./types";

export class EmailSuppressionManager {
  private readonly db: Firestore;

  constructor(db: Firestore) {
    this.db = db;
  }

  /**
   * Adds an email + sender combo to the suppression list.
   *
   * Creates a doc at `emailSuppressions/{email}/senders/{sender}` with the
   * given reason and a server timestamp.
   *
   * @param email  - The recipient email address (lowered).
   * @param sender - The email stream being suppressed for.
   * @param reason - Why this suppression was created.
   */
  async add(
    email: string,
    sender: Sender,
    reason: SuppressionReason,
  ): Promise<void> {
    const lowered = email.toLowerCase().trim();

    logger.info("[EmailSuppressionManager] add", {
      email: lowered,
      sender,
      reason,
    });

    await this.db
      .collection("emailSuppressions")
      .doc(lowered)
      .collection("senders")
      .doc(sender)
      .set({
        email: lowered,
        sender,
        reason,
        createdAt: FieldValue.serverTimestamp(),
      });
  }

  /**
   * Removes an email + sender combo from the suppression list.
   *
   * @param email  - The recipient email address.
   * @param sender - The email stream to re-enable.
   */
  async remove(email: string, sender: Sender): Promise<void> {
    const lowered = email.toLowerCase().trim();

    logger.info("[EmailSuppressionManager] remove", {
      email: lowered,
      sender,
    });

    await this.db
      .collection("emailSuppressions")
      .doc(lowered)
      .collection("senders")
      .doc(sender)
      .delete();
  }

  /**
   * Checks whether a given email + sender combination is suppressed.
   *
   * Reads the doc at `emailSuppressions/{email}/senders/{sender}`. If it
   * exists the combination is suppressed; otherwise it is not.
   *
   * @param email  - The recipient email address.
   * @param sender - The email stream to check.
   * @returns `true` if the combination is currently suppressed.
   */
  async isSuppressed(email: string, sender: Sender): Promise<boolean> {
    const lowered = email.toLowerCase().trim();

    const doc = await this.db
      .collection("emailSuppressions")
      .doc(lowered)
      .collection("senders")
      .doc(sender)
      .get();

    return doc.exists;
  }

  /**
   * Returns all senders that are suppressed for a given email.
   *
   * @param email - The recipient email address.
   * @returns Array of sender names.
   */
  async list(email: string): Promise<Sender[]> {
    const lowered = email.toLowerCase().trim();

    const snapshot = await this.db
      .collection("emailSuppressions")
      .doc(lowered)
      .collection("senders")
      .get();

    return snapshot.docs.map((d) => d.id as Sender);
  }
}
