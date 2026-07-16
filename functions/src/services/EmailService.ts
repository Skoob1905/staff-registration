import nodemailer from "nodemailer";
import { defineString, defineBoolean } from "firebase-functions/params";
import fs from "node:fs";
import path from "node:path";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { ResetPasswordTokenManager } from "../resetPasswordToken";

const SMTP_HOST = defineString("SMTP_HOST");
const SMTP_PORT = defineString("SMTP_PORT");
const SMTP_USER = defineString("SMTP_USER");
const SMTP_PASS = defineString("SMTP_PASS");
const SMTP_FROM = defineString("SMTP_FROM");
const RESET_CONTINUE_URL = defineString("RESET_CONTINUE_URL");
const EMAIL_ENABLED = defineBoolean("EMAIL_ENABLED", { default: true });

const TEMPLATES_DIR = path.resolve(__dirname, "../../templates");

export interface BatchEmailResult {
  sent: number;
  failed: number;
  failures: { email: string; error: string }[];
}

export class EmailProvider {
  private transporter: nodemailer.Transporter;

  /**
   * Creates an SMTP transporter using environment-configured credentials.
   *
   * Reads SMTP host, port, user, and password from Firebase-defined
   * parameters. The transporter is reused for all sends in the instance.
   */
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: SMTP_HOST.value(),
      port: Number(SMTP_PORT.value()),
      auth: { user: SMTP_USER.value(), pass: SMTP_PASS.value() },
    });
  }

  private tokenManager(): ResetPasswordTokenManager {
    return new ResetPasswordTokenManager(
      getFirestore(),
      getAuth(),
      `${RESET_CONTINUE_URL.value()}/reset-password`,
    );
  }

  /**
   * Sends an HTML email via the configured SMTP transporter.
   *
   * Low-level send primitive — all higher-level methods (registration,
   * reset, document, payslip) call this method after assembling the
   * template and link.
   *
   * @param email    - Recipient email address.
   * @param subject  - Email subject line.
   * @param htmlBody - Rendered HTML body of the email.
   * @throws {Error} If the SMTP transport fails (connection refused,
   *         authentication error, etc.).
   */
  async sendEmail({
    email,
    subject,
    htmlBody,
  }: {
    email: string;
    subject: string;
    htmlBody: string;
  }): Promise<void> {
    if (!EMAIL_ENABLED.value()) {
      return;
    }
    await this.transporter.sendMail({
      from: `MDS Payroll <${SMTP_FROM.value()}>`,
      to: email,
      subject,
      html: htmlBody,
    });
  }

  /**
   * Sends a batch of emails with a fixed delay between each send.
   *
   * Invokes the provided `emailCallback` once per address, waiting
   * **1 second** between consecutive invocations. Errors thrown by
   * individual callbacks are caught, recorded, and reported in the
   * returned result — a single failure does **not** stop the batch.
   *
   * @param emails        - Array of email addresses to send to.
   * @param emailCallback - Async callback invoked once per email;
   *                        receives `{ email: string }`.
   * @returns A {@link BatchEmailResult} with sent / failed counts and
   *          per-failure details.
   */
  async beginBatchEmailSend(
    emails: string[],
    emailCallback: (params: { email: string }) => Promise<void>,
  ): Promise<BatchEmailResult> {
    let sent = 0;
    let failed = 0;
    const failures: { email: string; error: string }[] = [];

    for (let i = 0; i < emails.length; i++) {
      try {
        await emailCallback({ email: emails[i] });
        sent++;
      } catch (err) {
        failed++;
        failures.push({
          email: emails[i],
          error: err instanceof Error ? err.message : String(err),
        });
      }
      if (i < emails.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return { sent, failed, failures };
  }

  /**
   * Sends a worker registration / welcome email.
   *
   * Pipeline:
   * 1. Generates a portal reset link via {@link generatePortalResetLink}.
   * 2. Reads the `registration.html` template from the filesystem.
   * 3. Replaces all `{{link}}` placeholders with the generated URL.
   * 4. Dispatches the email via {@link sendEmail}.
   *
   * @param email - Recipient email address.
   * @throws {FirebaseAuthError} From {@link generatePortalResetLink}.
   * @throws {Error} If the template file is missing or the SMTP send fails.
   */
  async sendWorkerRegistrationLink(email: string): Promise<void> {
    const customLink = await this.tokenManager().getResetLink(email);
    const templatePath = path.join(TEMPLATES_DIR, "registration.html");
    const raw = fs.readFileSync(templatePath, "utf-8");
    const htmlBody = raw
      .replace(/\{\{link\}\}/g, customLink)
      .replace(
        /\{\{logoUrl\}\}/g,
        `${RESET_CONTINUE_URL.value()}/mds/logo.png`,
      );
    await this.sendEmail({
      email,
      subject: "Welcome to MDS",
      htmlBody,
    });
  }

  /**
   * Sends an agency registration / welcome email.
   *
   * Pipeline:
   * 1. Generates a portal reset link via {@link generatePortalResetLink}.
   * 2. Reads the `agencyRegistration.html` template from the filesystem.
   * 3. Replaces all `{{link}}` placeholders with the generated URL.
   * 4. Dispatches the email via {@link sendEmail}.
   *
   * @param email - Recipient email address.
   * @throws {FirebaseAuthError} From {@link generatePortalResetLink}.
   * @throws {Error} If the template file is missing or the SMTP send fails.
   */
  async sendAgencyRegistrationLink(email: string): Promise<void> {
    const customLink = await this.tokenManager().getResetLink(email);
    const templatePath = path.join(TEMPLATES_DIR, "agencyRegistration.html");
    const raw = fs.readFileSync(templatePath, "utf-8");
    const htmlBody = raw
      .replace(/\{\{link\}\}/g, customLink)
      .replace(
        /\{\{logoUrl\}\}/g,
        `${RESET_CONTINUE_URL.value()}/mds/logo.png`,
      );
    await this.sendEmail({
      email,
      subject: "Welcome to MDS",
      htmlBody,
    });
  }

  /**
   * Sends a client registration / welcome email.
   *
   * Pipeline:
   * 1. Generates a portal reset link via {@link generatePortalResetLink}.
   * 2. Reads the `clientRegistration.html` template from the filesystem.
   * 3. Replaces all `{{link}}` placeholders with the generated URL.
   * 4. Dispatches the email via {@link sendEmail}.
   *
   * @param email - Recipient email address.
   * @throws {FirebaseAuthError} From {@link generatePortalResetLink}.
   * @throws {Error} If the template file is missing or the SMTP send fails.
   */
  async sendClientRegistrationLink(email: string): Promise<void> {
    const customLink = await this.tokenManager().getResetLink(email);
    const templatePath = path.join(TEMPLATES_DIR, "clientRegistration.html");
    const raw = fs.readFileSync(templatePath, "utf-8");
    const htmlBody = raw
      .replace(/\{\{link\}\}/g, customLink)
      .replace(
        /\{\{logoUrl\}\}/g,
        `${RESET_CONTINUE_URL.value()}/mds/logo.png`,
      );
    await this.sendEmail({
      email,
      subject: "Welcome to MDS",
      htmlBody,
    });
  }

  /**
   * Sends a password reset email (forgot password flow).
   *
   * Pipeline:
   * 1. Reads the `forgotPassword.html` template from the filesystem.
   * 2. Replaces all `{{link}}` placeholders with the provided reset link.
   * 3. Dispatches the email via {@link sendEmail}.
   *
   * If no `resetLink` is provided the email is silently skipped — it does
   * NOT fall back to the Firebase oobCode flow.
   *
   * The subject is always "Reset your password".
   *
   * @param email    - Recipient email address.
   * @param resetLink - The custom reset URL. Email is not sent when empty.
   * @throws {Error} If the template file is missing or the SMTP send fails.
   */
  async sendResetPassword(email: string, resetLink: string): Promise<void> {
    if (!resetLink) {
      return;
    }

    const subject = "Reset your password";
    const templateName = "forgotPassword.html";
    const templatePath = path.join(TEMPLATES_DIR, templateName);
    const raw = fs.readFileSync(templatePath, "utf-8");
    const htmlBody = raw
      .replace(/\{\{link\}\}/g, resetLink)
      .replace(
        /\{\{logoUrl\}\}/g,
        `${RESET_CONTINUE_URL.value()}/mds/logo.png`,
      );
    await this.sendEmail({ email, subject, htmlBody });
  }

  /**
   * Sends a document-upload notification email.
   *
   * Unlike registration/reset emails this method uses a **direct** portal
   * link (`RESET_CONTINUE_URL`) — no password reset `oobCode` is generated.
   * The subject is always "Document Uploaded!" and the template is always
   * `sendDocument.html`.
   *
   * @param email - Recipient email address.
   * @throws {Error} If the template file is missing or the SMTP send fails.
   */
  async sendDocumentEmail(email: string): Promise<void> {
    const subject = "Document Uploaded!";
    const templateName = "sendDocument.html";
    const portalLink = RESET_CONTINUE_URL.value();
    const templatePath = path.join(TEMPLATES_DIR, templateName);
    const raw = fs.readFileSync(templatePath, "utf-8");
    const htmlBody = raw
      .replace(/\{\{link\}\}/g, portalLink)
      .replace(
        /\{\{logoUrl\}\}/g,
        `${RESET_CONTINUE_URL.value()}/mds/logo.png`,
      );
    await this.sendEmail({ email, subject, htmlBody });
  }

  /**
   * Sends a payslip-available notification email.
   *
   * Unlike registration/reset emails this method uses a **direct** portal
   * link (`RESET_CONTINUE_URL`) — no password reset `oobCode` is generated.
   * The subject is always "Payslip Received!" and the template is always
   * `sendPayslip.html`.
   *
   * @param email - Recipient email address.
   * @throws {Error} If the template file is missing or the SMTP send fails.
   */
  async sendPayslipEmail(email: string): Promise<void> {
    const subject = "Payslip Received!";
    const templateName = "sendPayslip.html";
    const portalLink = RESET_CONTINUE_URL.value();
    const templatePath = path.join(TEMPLATES_DIR, templateName);
    const raw = fs.readFileSync(templatePath, "utf-8");
    const htmlBody = raw
      .replace(/\{\{link\}\}/g, portalLink)
      .replace(
        /\{\{logoUrl\}\}/g,
        `${RESET_CONTINUE_URL.value()}/mds/logo.png`,
      );
    await this.sendEmail({ email, subject, htmlBody });
  }
}
