import nodemailer from "nodemailer";
import { getAuth } from "firebase-admin/auth";
import { defineString } from "firebase-functions/params";

const SMTP_HOST = defineString("SMTP_HOST");
const SMTP_PORT = defineString("SMTP_PORT");
const SMTP_USER = defineString("SMTP_USER");
const SMTP_PASS = defineString("SMTP_PASS");
const SMTP_FROM = defineString("SMTP_FROM");
const RESET_CONTINUE_URL = defineString("RESET_CONTINUE_URL");

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
      from: SMTP_FROM.value(),
      to: email,
      subject,
      html: htmlBody,
    });
  }
}
