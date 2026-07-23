import { PubSub, type Topic } from "@google-cloud/pubsub";
import * as logger from "firebase-functions/logger";

const TOPIC_NAME = "bulk-email-send";

let pubSubClient: PubSub | null = null;
let topic: Topic | null = null;

function getTopic(): Topic {
  if (!topic) {
    pubSubClient = new PubSub();
    topic = pubSubClient.topic(TOPIC_NAME);
  }
  return topic;
}

export type BulkEmailType =
  | "payslip"
  | "staff_registration"
  | "agency_registration"
  | "client_registration"
  | "staff_document";

export interface BulkEmailMessage {
  type: BulkEmailType;
  emails: string[];
  metadata?: Record<string, string>;
}

export async function publishBulkEmailJob(
  type: BulkEmailType,
  emails: string[],
  metadata?: Record<string, string>,
): Promise<string | null> {
  if (!Array.isArray(emails) || emails.length === 0) {
    logger.warn("[publishBulkEmailJob] No emails to publish", { type });
    return null;
  }

  try {
    const message: BulkEmailMessage = { type, emails, metadata };
    const dataBuffer = Buffer.from(JSON.stringify(message));
    const messageId = await getTopic().publishMessage({ data: dataBuffer });
    logger.info("[publishBulkEmailJob] Published", {
      type,
      count: emails.length,
      messageId,
    });
    return messageId;
  } catch (err) {
    logger.error("[publishBulkEmailJob] Failed to publish", {
      type,
      count: emails.length,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
