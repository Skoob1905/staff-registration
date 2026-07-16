import nodemailer from "nodemailer";
import { defineString, defineBoolean } from "firebase-functions/params";
import fs from "node:fs";
import path from "node:path";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { ResetPasswordTokenManager } from "../resetPasswordToken";
import * as logger from "firebase-functions/logger";

const SMTP_HOST = defineString("SMTP_HOST");
const SMTP_PORT = defineString("SMTP_PORT");
const SMTP_PASS = defineString("SMTP_PASS");

// Registration User
const REGISTRATION_SMTP_USER = defineString("REGISTRATION_SMTP_USER");
const REGISTRATION_SMTP_FROM = defineString("REGISTRATION_SMTP_FROM");

// Payslips User
const PAYSLIPS_SMTP_USER = defineString("PAYSLIPS_SMTP_USER");
const PAYSLIPS_SMTP_FROM = defineString("PAYSLIPS_SMTP_FROM");

// Documents User
const DOCUMENTS_SMTP_USER = defineString("DOCUMENTS_SMTP_USER");
const DOCUMENTS_SMTP_FROM = defineString("DOCUMENTS_SMTP_FROM");

const RESET_CONTINUE_URL = defineString("RESET_CONTINUE_URL");
const EMAIL_ENABLED = defineBoolean("EMAIL_ENABLED", { default: true });

const TEMPLATES_DIR = path.resolve(__dirname, "../../templates");

export interface BatchEmailResult {
  sent: number;
  failed: number;
  failures: { email: string; error: string }[];
}

export class EmailProvider {
  private payslipsTransporter: nodemailer.Transporter;
  private registrationTransporter: nodemailer.Transporter;
  private documentsTransporter: nodemailer.Transporter;

  constructor() {
    this.registrationTransporter = nodemailer.createTransport({
      host: SMTP_HOST.value(),
      port: Number(SMTP_PORT.value()),
      auth: { user: REGISTRATION_SMTP_USER.value(), pass: SMTP_PASS.value() },
    });
    this.payslipsTransporter = nodemailer.createTransport({
      host: SMTP_HOST.value(),
      port: Number(SMTP_PORT.value()),
      auth: { user: PAYSLIPS_SMTP_USER.value(), pass: SMTP_PASS.value() },
    });
    this.documentsTransporter = nodemailer.createTransport({
      host: SMTP_HOST.value(),
      port: Number(SMTP_PORT.value()),
      auth: { user: DOCUMENTS_SMTP_USER.value(), pass: SMTP_PASS.value() },
    });
    logger.info("[EmailProvider] transporter created", {
      host: SMTP_HOST.value(),
      port: SMTP_PORT.value(),
    });
  }

  private tokenManager(): ResetPasswordTokenManager {
    return new ResetPasswordTokenManager(
      getFirestore(),
      getAuth(),
      `${RESET_CONTINUE_URL.value()}/reset-password`,
    );
  }

  async sendEmail({
    email,
    subject,
    htmlBody,
    emailUser: emailUser = "registration",
  }: {
    email: string;
    subject: string;
    htmlBody: string;
    emailUser?: "payslips" | "registration" | "documents";
  }): Promise<void> {
    if (!EMAIL_ENABLED.value()) {
      logger.warn("[EmailProvider] sendEmail: EMAIL_ENABLED=false, skipping", {
        email,
        subject,
      });
      return;
    }

    logger.info("[EmailProvider] sendEmail: sending", { email, subject });

    try {
      switch (emailUser) {
        case "payslips":
          await this.payslipsTransporter.sendMail({
            from: `MDS Payroll <${PAYSLIPS_SMTP_FROM.value()}>`,
            to: email,
            subject,
            html: htmlBody,
          });
          break;
        case "documents":
          await this.documentsTransporter.sendMail({
            from: `MDS Payroll <${DOCUMENTS_SMTP_FROM.value()}>`,
            to: email,
            subject,
            html: htmlBody,
          });
          break;
        default:
          await this.registrationTransporter.sendMail({
            from: `MDS Payroll <${REGISTRATION_SMTP_FROM.value()}>`,
            to: email,
            subject,
            html: htmlBody,
          });
      }
    } catch (err) {
      logger.error("[EmailProvider] sendEmail: SMTP send failed", {
        email,
        subject,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    logger.info("[EmailProvider] sendEmail: sent successfully", {
      email,
      subject,
    });
  }

  async beginBatchEmailSend(
    emails: string[],
    emailCallback: (params: { email: string }) => Promise<void>,
  ): Promise<BatchEmailResult> {
    let sent = 0;
    let failed = 0;
    const failures: { email: string; error: string }[] = [];

    logger.info("[EmailProvider] beginBatchEmailSend: starting batch", {
      total: emails.length,
    });

    for (let i = 0; i < emails.length; i++) {
      logger.info("[EmailProvider] beginBatchEmailSend: processing", {
        index: i + 1,
        total: emails.length,
        email: emails[i],
      });

      try {
        await emailCallback({ email: emails[i] });
        sent++;
        logger.info("[EmailProvider] beginBatchEmailSend: sent", {
          email: emails[i],
        });
      } catch (err) {
        failed++;
        const errorMsg = err instanceof Error ? err.message : String(err);
        failures.push({ email: emails[i], error: errorMsg });
        logger.error("[EmailProvider] beginBatchEmailSend: failed", {
          email: emails[i],
          error: errorMsg,
        });
      }

      if (i < emails.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    logger.info("[EmailProvider] beginBatchEmailSend: complete", {
      total: emails.length,
      sent,
      failed,
    });

    return { sent, failed, failures };
  }

  async sendWorkerRegistrationLink(email: string): Promise<void> {
    logger.info("[EmailProvider] sendWorkerRegistrationLink: starting", {
      email,
    });

    const customLink = await this.tokenManager().getResetLink(email);
    const templatePath = path.join(TEMPLATES_DIR, "registration.html");

    let raw: string;
    try {
      raw = fs.readFileSync(templatePath, "utf-8");
    } catch (err) {
      logger.error(
        "[EmailProvider] sendWorkerRegistrationLink: template not found",
        {
          templatePath,
          error: err instanceof Error ? err.message : String(err),
        },
      );
      throw err;
    }

    const htmlBody = raw
      .replace(/\{\{link\}\}/g, customLink)
      .replace(
        /\{\{logoUrl\}\}/g,
        `${RESET_CONTINUE_URL.value()}/mds/logo.png`,
      );

    await this.sendEmail({ email, subject: "Welcome to MDS", htmlBody });
  }

  async sendAgencyRegistrationLink(email: string): Promise<void> {
    logger.info("[EmailProvider] sendAgencyRegistrationLink: starting", {
      email,
    });

    const customLink = await this.tokenManager().getResetLink(email);
    const templatePath = path.join(TEMPLATES_DIR, "agencyRegistration.html");

    let raw: string;
    try {
      raw = fs.readFileSync(templatePath, "utf-8");
    } catch (err) {
      logger.error(
        "[EmailProvider] sendAgencyRegistrationLink: template not found",
        {
          templatePath,
          error: err instanceof Error ? err.message : String(err),
        },
      );
      throw err;
    }

    const htmlBody = raw
      .replace(/\{\{link\}\}/g, customLink)
      .replace(
        /\{\{logoUrl\}\}/g,
        `${RESET_CONTINUE_URL.value()}/mds/logo.png`,
      );

    await this.sendEmail({ email, subject: "Welcome to MDS", htmlBody });
  }

  async sendClientRegistrationLink(email: string): Promise<void> {
    logger.info("[EmailProvider] sendClientRegistrationLink: starting", {
      email,
    });

    const customLink = await this.tokenManager().getResetLink(email);
    const templatePath = path.join(TEMPLATES_DIR, "clientRegistration.html");

    let raw: string;
    try {
      raw = fs.readFileSync(templatePath, "utf-8");
    } catch (err) {
      logger.error(
        "[EmailProvider] sendClientRegistrationLink: template not found",
        {
          templatePath,
          error: err instanceof Error ? err.message : String(err),
        },
      );
      throw err;
    }

    const htmlBody = raw
      .replace(/\{\{link\}\}/g, customLink)
      .replace(
        /\{\{logoUrl\}\}/g,
        `${RESET_CONTINUE_URL.value()}/mds/logo.png`,
      );

    await this.sendEmail({ email, subject: "Welcome to MDS", htmlBody });
  }

  async sendResetPassword(email: string, resetLink: string): Promise<void> {
    if (!resetLink) {
      logger.warn("[EmailProvider] sendResetPassword: no resetLink, skipping", {
        email,
      });
      return;
    }

    logger.info("[EmailProvider] sendResetPassword: starting", { email });

    const templateName = "forgotPassword.html";
    const templatePath = path.join(TEMPLATES_DIR, templateName);

    let raw: string;
    try {
      raw = fs.readFileSync(templatePath, "utf-8");
    } catch (err) {
      logger.error("[EmailProvider] sendResetPassword: template not found", {
        templatePath,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    const htmlBody = raw
      .replace(/\{\{link\}\}/g, resetLink)
      .replace(
        /\{\{logoUrl\}\}/g,
        `${RESET_CONTINUE_URL.value()}/mds/logo.png`,
      );

    await this.sendEmail({ email, subject: "Reset your password", htmlBody });
  }

  async sendDocumentEmail(email: string): Promise<void> {
    logger.info("[EmailProvider] sendDocumentEmail: starting", { email });

    const templateName = "sendDocument.html";
    const portalLink = RESET_CONTINUE_URL.value();
    const templatePath = path.join(TEMPLATES_DIR, templateName);

    let raw: string;
    try {
      raw = fs.readFileSync(templatePath, "utf-8");
    } catch (err) {
      logger.error("[EmailProvider] sendDocumentEmail: template not found", {
        templatePath,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    const htmlBody = raw
      .replace(/\{\{link\}\}/g, portalLink)
      .replace(
        /\{\{logoUrl\}\}/g,
        `${RESET_CONTINUE_URL.value()}/mds/logo.png`,
      );

    await this.sendEmail({ email, subject: "Document Uploaded!", htmlBody, emailUser: "documents" });
  }

  async sendPayslipEmail(email: string): Promise<void> {
    logger.info("[EmailProvider] sendPayslipEmail: starting", { email });

    const templateName = "sendPayslip.html";
    const portalLink = RESET_CONTINUE_URL.value();
    const templatePath = path.join(TEMPLATES_DIR, templateName);

    let raw: string;
    try {
      raw = fs.readFileSync(templatePath, "utf-8");
    } catch (err) {
      logger.error("[EmailProvider] sendPayslipEmail: template not found", {
        templatePath,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    const htmlBody = raw
      .replace(/\{\{link\}\}/g, portalLink)
      .replace(
        /\{\{logoUrl\}\}/g,
        `${RESET_CONTINUE_URL.value()}/mds/logo.png`,
      );

    await this.sendEmail({
      email,
      subject: "Payslip Received!",
      htmlBody,
      emailUser: "payslips",
    });
  }
}
