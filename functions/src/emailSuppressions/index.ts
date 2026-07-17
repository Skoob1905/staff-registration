import { onRequest } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { EmailSuppressionManager } from "./EmailSuppressionManager";
import { isValidSender, isValidEmail } from "./types";
import { successHtml, errorHtml } from "./unsubscribePage";

export { EmailSuppressionManager } from "./EmailSuppressionManager";

/**
 * Public HTTP endpoint that handles unsubscription requests.
 *
 * Accepts GET (browser click from email body) and POST (`List-Unsubscribe`
 * header) requests. Reads `email` and `sender` from query parameters and
 * writes a suppression doc to Firestore.
 *
 * @param req.query.email  - The recipient email address to suppress.
 * @param req.query.sender - The email stream to suppress (`registration`,
 *                           `payslips`, or `documents`).
 * @returns An HTML page indicating success or failure.
 */
export const unsubscribeEmail = onRequest(
  { region: "europe-west2" },
  async (req, res) => {
    const email = String(req.query.email || "").trim().toLowerCase();
    const sender = String(req.query.sender || "").trim().toLowerCase();

    if (!email || !isValidEmail(email)) {
      res.status(400).type("html").send(errorHtml("Missing or invalid email parameter."));
      return;
    }

    if (!sender || !isValidSender(sender)) {
      res.status(400).type("html").send(errorHtml("Missing or invalid sender parameter."));
      return;
    }

    try {
      const db = getFirestore();
      const manager = new EmailSuppressionManager(db);
      await manager.add(email, sender, "unsubscribed");

      logger.info("[unsubscribeEmail] suppressed", { email, sender });

      res.status(200).type("html").send(successHtml(email, sender));
    } catch (err) {
      logger.error("[unsubscribeEmail] failed", {
        email,
        sender,
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500).type("html").send(errorHtml("An unexpected error occurred. Please try again later."));
    }
  },
);
