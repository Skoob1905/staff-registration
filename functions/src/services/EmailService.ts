import nodemailer from "nodemailer";
import { getAuth } from "firebase-admin/auth";
import { defineString } from "firebase-functions/params";
import fs from "node:fs";
import path from "node:path";

const SMTP_HOST = defineString("SMTP_HOST");
const SMTP_PORT = defineString("SMTP_PORT");
const SMTP_USER = defineString("SMTP_USER");
const SMTP_PASS = defineString("SMTP_PASS");
const SMTP_FROM = defineString("SMTP_FROM");
const RESET_CONTINUE_URL = defineString("RESET_CONTINUE_URL");

const TEMPLATES_DIR = path.resolve(__dirname, "../../templates");

export class EmailProvider {
  private transporter: nodemailer.Transporter;

  /** Creates an SMTP transporter using environment-configured credentials. */
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: SMTP_HOST.value(),
      port: Number(SMTP_PORT.value()),
      auth: { user: SMTP_USER.value(), pass: SMTP_PASS.value() },
    });
  }

  /**
   * Generates a Firebase password reset link for the given email.
   *
   * @param email - The recipient email address.
   * @returns A Firebase password reset URL with `handleCodeInApp` enabled.
   */
  async generatePasswordResetLink(email: string): Promise<string> {
    return getAuth().generatePasswordResetLink(email, {
      url: RESET_CONTINUE_URL.value(),
      handleCodeInApp: true,
    });
  }

  /**
   * Generates a portal reset link by extracting the oobCode and apiKey
   * from a Firebase password reset link and appending them to the
   * configured continue URL.
   *
   * @param email - The recipient email address.
   * @returns A portal reset URL with `mode`, `oobCode`, and `apiKey` query params.
   */
  async generatePortalResetLink(email: string): Promise<string> {
    const firebaseLink = await this.generatePasswordResetLink(email);
    const url = new URL(firebaseLink);
    const oobCode = url.searchParams.get("oobCode") ?? "";
    const apiKey = url.searchParams.get("apiKey") ?? "";
    return `${RESET_CONTINUE_URL.value()}/reset-password?mode=resetPassword&oobCode=${oobCode}&apiKey=${apiKey}`;
  }

  /**
   * Sends an HTML email via the configured SMTP transporter.
   *
   * @param email    - Recipient email address.
   * @param subject  - Email subject line.
   * @param htmlBody - Rendered HTML body of the email.
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
    await this.transporter.sendMail({
      from: `MDS Payroll <${SMTP_FROM.value()}>`,
      to: email,
      subject,
      html: htmlBody,
    });
  }

  /**
   * Sends a batch of emails with a 1-second delay between each send.
   *
   * @param emails        - Array of email addresses to send to.
   * @param emailCallback - Async callback invoked once per email;
   *                        receives `{ email: string }`.
   */
  async beginBatchEmailSend(
    emails: string[],
    emailCallback: (params: { email: string }) => Promise<void>,
  ): Promise<void> {
    for (let i = 0; i < emails.length; i++) {
      await emailCallback({ email: emails[i] });
      if (i < emails.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  /**
   * Sends a worker registration / welcome email using the "registration.html" template.
   *
   * @param email - Recipient email address.
   */
  async sendWorkerRegistrationLink(email: string): Promise<void> {
    const customLink = await this.generatePortalResetLink(email);
    const templatePath = path.join(TEMPLATES_DIR, "registration.html");
    const raw = fs.readFileSync(templatePath, "utf-8");
    const htmlBody = raw.replace(/\{\{link\}\}/g, customLink);
    await this.sendEmail({
      email,
      subject: "Welcome to MDS",
      htmlBody,
    });
  }

  /**
   * Sends an agency registration / welcome email using the "agencyRegistration.html" template.
   *
   * @param email - Recipient email address.
   */
  async sendAgencyRegistrationLink(email: string): Promise<void> {
    const customLink = await this.generatePortalResetLink(email);
    const templatePath = path.join(TEMPLATES_DIR, "agencyRegistration.html");
    const raw = fs.readFileSync(templatePath, "utf-8");
    const htmlBody = raw.replace(/\{\{link\}\}/g, customLink);
    await this.sendEmail({
      email,
      subject: "Welcome to MDS",
      htmlBody,
    });
  }

  /**
   * Sends a client registration / welcome email using the "clientRegistration.html" template.
   *
   * @param email - Recipient email address.
   */
  async sendClientRegistrationLink(email: string): Promise<void> {
    const customLink = await this.generatePortalResetLink(email);
    const templatePath = path.join(TEMPLATES_DIR, "clientRegistration.html");
    const raw = fs.readFileSync(templatePath, "utf-8");
    const htmlBody = raw.replace(/\{\{link\}\}/g, customLink);
    await this.sendEmail({
      email,
      subject: "Welcome to MDS",
      htmlBody,
    });
  }

  /**
   * Sends a password reset email (forgot password flow).
   *
   * Reads the supplied HTML template, replaces `{{link}}` placeholders
   * with a freshly generated portal reset link, and dispatches the email.
   *
   * @param email        - Recipient email address.
   * @param subject      - Email subject line (defaults to "Reset your password").
   * @param templateName - HTML template filename located in `functions/templates/`
   *                       (defaults to "forgotPassword.html").
   */
  async sendResetPassword({
    email,
    subject = "Reset your password",
    templateName = "forgotPassword.html",
  }: {
    email: string;
    subject?: string;
    templateName?: string;
  }): Promise<void> {
    const customLink = await this.generatePortalResetLink(email);
    const templatePath = path.join(TEMPLATES_DIR, templateName);
    const raw = fs.readFileSync(templatePath, "utf-8");
    const htmlBody = raw.replace(/\{\{link\}\}/g, customLink);
    await this.sendEmail({ email, subject, htmlBody });
  }

  /**
   * Sends a document-upload notification email.
   *
   * Uses the "sendDocument.html" template and a direct portal link
   * (no password reset code). Subject is always "Document Uploaded!".
   *
   * @param email - Recipient email address.
   */
  async sendDocumentEmail({ email }: { email: string }): Promise<void> {
    const subject = "Document Uploaded!";
    const templateName = "sendDocument.html";
    const portalLink = RESET_CONTINUE_URL.value();
    const templatePath = path.join(TEMPLATES_DIR, templateName);
    const raw = fs.readFileSync(templatePath, "utf-8");
    const htmlBody = raw.replace(/\{\{link\}\}/g, portalLink);
    await this.sendEmail({ email, subject, htmlBody });
  }

  /**
   * Sends a payslip-available notification email.
   *
   * Uses the "sendPayslip.html" template and a direct portal link
   * (no password reset code). Subject is always "Payslip Received!".
   *
   * @param email - Recipient email address.
   */
  async sendPayslipEmail({ email }: { email: string }): Promise<void> {
    const subject = "Payslip Received!";
    const templateName = "sendPayslip.html";
    const portalLink = RESET_CONTINUE_URL.value();
    const templatePath = path.join(TEMPLATES_DIR, templateName);
    const raw = fs.readFileSync(templatePath, "utf-8");
    const htmlBody = raw.replace(/\{\{link\}\}/g, portalLink);
    await this.sendEmail({ email, subject, htmlBody });
  }
}
