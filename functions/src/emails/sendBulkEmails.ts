import { onMessagePublished } from "firebase-functions/v2/pubsub";
import { getFirestore } from "firebase-admin/firestore";
import { EmailProvider } from "../services/EmailService";
import * as logger from "firebase-functions/logger";
import { defineInt } from "firebase-functions/params";
import type { BulkEmailMessage } from "./publishEmails";

const EMAILS_PER_HOUR = defineInt("EMAILS_PER_HOUR", { default: 200 });

export const sendBulkEmails = onMessagePublished(
  { topic: "bulk-email-send", region: "europe-west2", maxInstances: 1 },
  async (event) => {
    const message: BulkEmailMessage = event.data.message.json;
    const { type, emails } = message;

    if (!Array.isArray(emails) || emails.length === 0) {
      logger.warn("[sendBulkEmails] No emails to send", { type });
      return;
    }

    const emailProvider = new EmailProvider();
    const db = getFirestore();

    let callback: (params: { email: string }) => Promise<void>;

    switch (type) {
      case "payslip":
        callback = ({ email }) => emailProvider.sendPayslipEmail(email);
        break;

      case "staff_registration":
        callback = async ({ email }) => {
          try {
            await emailProvider.sendWorkerRegistrationLink(email);
          } catch (err) {
            logger.error(
              "[sendBulkEmails] staff registration email failed",
              {
                email,
                error: err instanceof Error ? err.message : String(err),
              },
            );
            const snaps = await db
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
          const staffSnaps = await db
            .collection("staff")
            .where("email", "==", email)
            .get();
          for (const d of staffSnaps.docs) {
            await d.ref.update("metadata.loginStatus", "awaiting_login");
          }
        };
        break;

      case "agency_registration":
        callback = ({ email }) =>
          emailProvider.sendAgencyRegistrationLink(email);
        break;

      case "client_registration":
        callback = ({ email }) =>
          emailProvider.sendClientRegistrationLink(email);
        break;

      case "staff_document":
        callback = ({ email }) => emailProvider.sendDocumentEmail(email);
        break;

      default:
        logger.warn("[sendBulkEmails] Unknown email type", { type });
        return;
    }

    const result = await emailProvider.beginBatchEmailSend(
      emails,
      callback,
      EMAILS_PER_HOUR.value(),
    );

    logger.info("[sendBulkEmails] Complete", { type, ...result });
  },
);
