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

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: SMTP_HOST.value(),
      port: Number(SMTP_PORT.value()),
      auth: { user: SMTP_USER.value(), pass: SMTP_PASS.value() },
    });
  }

  async generatePasswordResetLink(email: string): Promise<string> {
    return getAuth().generatePasswordResetLink(email, {
      url: RESET_CONTINUE_URL.value(),
      handleCodeInApp: true,
    });
  }

  async generatePortalResetLink(email: string): Promise<string> {
    const firebaseLink = await this.generatePasswordResetLink(email);
    const url = new URL(firebaseLink);
    const oobCode = url.searchParams.get("oobCode") ?? "";
    const apiKey = url.searchParams.get("apiKey") ?? "";
    return `${RESET_CONTINUE_URL.value()}/reset-password?mode=resetPassword&oobCode=${oobCode}&apiKey=${apiKey}`;
  }

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
   * Send a user the welcome/registration
   */
  async sendRegistrationLink({
    email,
    subject = "Welcome to MDS",
    templateName = "registration.html",
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
   * Send a document notificaiton email
   */
  async sendDocument({
    email,
    subject = "New document available",
    templateName = "sendDocument.html",
  }: {
    email: string;
    subject?: string;
    templateName?: string;
  }): Promise<void> {
    const portalLink = RESET_CONTINUE_URL.value();
    const templatePath = path.join(TEMPLATES_DIR, templateName);
    const raw = fs.readFileSync(templatePath, "utf-8");
    const htmlBody = raw.replace(/\{\{link\}\}/g, portalLink);
    await this.sendEmail({ email, subject, htmlBody });
  }

  /**
   * Send a user the payslip notification
   */
  async sentPayslip({
    email,
    subject = "Payslip received!",
    templateName = "sendPayslip.html",
  }: {
    email: string;
    subject?: string;
    templateName?: string;
  }): Promise<void> {
    const portalLink = RESET_CONTINUE_URL.value();
    const templatePath = path.join(TEMPLATES_DIR, templateName);
    const raw = fs.readFileSync(templatePath, "utf-8");
    const htmlBody = raw.replace(/\{\{link\}\}/g, portalLink);
    await this.sendEmail({ email, subject, htmlBody });
  }
}
