import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockSendMail } = vi.hoisted(() => ({
  mockSendMail: vi.fn().mockResolvedValue(true),
}));

const { mockGeneratePasswordResetLink } = vi.hoisted(() => ({
  mockGeneratePasswordResetLink: vi
    .fn()
    .mockResolvedValue("https://mock.link?oobCode=abc123&apiKey=my-api-key"),
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: mockSendMail,
    })),
  },
}));

vi.mock("firebase-functions/params", () => ({
  defineString: vi.fn(() => ({
    value: vi.fn(() => "mock-continue-url"),
  })),
}));

vi.mock("firebase-admin/auth", () => ({
  getAuth: vi.fn(() => ({
    generatePasswordResetLink: mockGeneratePasswordResetLink,
  })),
}));

vi.mock("node:fs", () => ({
  default: {
    readFileSync: vi.fn(() => '<a href="{{link}}">Click here</a>'),
  },
}));

import { EmailProvider } from "../EmailService";

describe("EmailProvider", () => {
  let emailProvider: EmailProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    emailProvider = new EmailProvider();
  });

  describe("constructor", () => {
    it("creates an SMTP transporter", () => {
      expect(emailProvider).toBeInstanceOf(EmailProvider);
    });
  });

  describe("generatePasswordResetLink", () => {
    it("calls Firebase Auth with the correct email and continue URL", async () => {
      const result = await emailProvider.generatePasswordResetLink(
        "user@example.com",
      );

      expect(mockGeneratePasswordResetLink).toHaveBeenCalledTimes(1);
      expect(mockGeneratePasswordResetLink).toHaveBeenCalledWith(
        "user@example.com",
        {
          url: "mock-continue-url",
          handleCodeInApp: true,
        },
      );
      expect(result).toBe(
        "https://mock.link?oobCode=abc123&apiKey=my-api-key",
      );
    });
  });

  describe("generatePortalResetLink", () => {
    it("extracts oobCode and apiKey and builds a portal reset URL", async () => {
      const result = await emailProvider.generatePortalResetLink(
        "user@example.com",
      );

      expect(mockGeneratePasswordResetLink).toHaveBeenCalledTimes(1);
      expect(result).toBe(
        "mock-continue-url/reset-password?mode=resetPassword&oobCode=abc123&apiKey=my-api-key",
      );
    });

    it("handles Firebase links with no oobCode gracefully", async () => {
      mockGeneratePasswordResetLink.mockResolvedValueOnce(
        "https://mock.link?apiKey=fallback-key",
      );

      const result = await emailProvider.generatePortalResetLink(
        "user@example.com",
      );

      expect(result).toBe(
        "mock-continue-url/reset-password?mode=resetPassword&oobCode=&apiKey=fallback-key",
      );
    });
  });

  describe("sendEmail", () => {
    it("dispatches an email via the SMTP transporter with correct fields", async () => {
      await emailProvider.sendEmail({
        email: "recipient@example.com",
        subject: "Hello World",
        htmlBody: "<p>Email body content</p>",
      });

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith({
        from: "MDS Payroll <mock-continue-url>",
        to: "recipient@example.com",
        subject: "Hello World",
        html: "<p>Email body content</p>",
      });
    });

    it("rejects when the SMTP transporter fails", async () => {
      mockSendMail.mockRejectedValueOnce(new Error("SMTP connection refused"));

      await expect(
        emailProvider.sendEmail({
          email: "user@example.com",
          subject: "Subject",
          htmlBody: "<p>Body</p>",
        }),
      ).rejects.toThrow("SMTP connection refused");
    });
  });

  describe("beginBatchEmailSend", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("calls the callback 100 times with 1-second intervals between each", async () => {
      const callback = vi.fn().mockResolvedValue(undefined);
      const emails = Array.from(
        { length: 100 },
        (_, i) => `user${i}@example.com`,
      );
      const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

      const promise = emailProvider.beginBatchEmailSend(emails, callback);

      for (let i = 0; i < 100; i++) {
        await vi.advanceTimersByTimeAsync(1000);
      }

      await promise;

      expect(callback).toHaveBeenCalledTimes(100);
      emails.forEach((email, i) => {
        expect(callback).toHaveBeenNthCalledWith(i + 1, { email });
      });

      expect(setTimeoutSpy).toHaveBeenCalledTimes(99);
      for (let i = 1; i <= 99; i++) {
        expect(setTimeoutSpy).toHaveBeenNthCalledWith(
          i,
          expect.any(Function),
          1000,
        );
      }

      setTimeoutSpy.mockRestore();
    });

    it("does not call the callback for an empty array", async () => {
      const callback = vi.fn().mockResolvedValue(undefined);

      await emailProvider.beginBatchEmailSend([], callback);

      expect(callback).not.toHaveBeenCalled();
    });

    it("calls once with no timer delay for a single email", async () => {
      const callback = vi.fn().mockResolvedValue(undefined);
      const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

      await emailProvider.beginBatchEmailSend(
        ["single@example.com"],
        callback,
      );

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({ email: "single@example.com" });
      expect(setTimeoutSpy).not.toHaveBeenCalled();

      setTimeoutSpy.mockRestore();
    });
  });

  describe("sendWorkerRegistrationLink", () => {
    it("generates a portal reset link, reads registration.html, replaces {{link}}, and sends the email", async () => {
      await emailProvider.sendWorkerRegistrationLink("worker@example.com");

      expect(mockGeneratePasswordResetLink).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith({
        from: "MDS Payroll <mock-continue-url>",
        to: "worker@example.com",
        subject: "Welcome to MDS",
        html: '<a href="mock-continue-url/reset-password?mode=resetPassword&oobCode=abc123&apiKey=my-api-key">Click here</a>',
      });
    });
  });

  describe("sendAgencyRegistrationLink", () => {
    it("generates a portal reset link, reads agencyRegistration.html, replaces {{link}}, and sends the email", async () => {
      await emailProvider.sendAgencyRegistrationLink("agency@example.com");

      expect(mockGeneratePasswordResetLink).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith({
        from: "MDS Payroll <mock-continue-url>",
        to: "agency@example.com",
        subject: "Welcome to MDS",
        html: '<a href="mock-continue-url/reset-password?mode=resetPassword&oobCode=abc123&apiKey=my-api-key">Click here</a>',
      });
    });
  });

  describe("sendClientRegistrationLink", () => {
    it("generates a portal reset link, reads clientRegistration.html, replaces {{link}}, and sends the email", async () => {
      await emailProvider.sendClientRegistrationLink("client@example.com");

      expect(mockGeneratePasswordResetLink).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith({
        from: "MDS Payroll <mock-continue-url>",
        to: "client@example.com",
        subject: "Welcome to MDS",
        html: '<a href="mock-continue-url/reset-password?mode=resetPassword&oobCode=abc123&apiKey=my-api-key">Click here</a>',
      });
    });
  });

  describe("sendResetPassword", () => {
    it("generates a portal reset link, reads the template, replaces {{link}}, and sends the email", async () => {
      await emailProvider.sendResetPassword({
        email: "user@example.com",
      });

      expect(mockGeneratePasswordResetLink).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith({
        from: "MDS Payroll <mock-continue-url>",
        to: "user@example.com",
        subject: "Reset your password",
        html: '<a href="mock-continue-url/reset-password?mode=resetPassword&oobCode=abc123&apiKey=my-api-key">Click here</a>',
      });
    });

    it("accepts a custom subject and template name", async () => {
      await emailProvider.sendResetPassword({
        email: "user@example.com",
        subject: "Custom Reset",
        templateName: "customReset.html",
      });

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "Custom Reset",
        }),
      );
    });
  });

  describe("sendDocumentEmail", () => {
    it("sends a notification with the hardcoded subject and a direct portal link", async () => {
      await emailProvider.sendDocumentEmail({ email: "staff@example.com" });

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith({
        from: "MDS Payroll <mock-continue-url>",
        to: "staff@example.com",
        subject: "Document Uploaded!",
        html: '<a href="mock-continue-url">Click here</a>',
      });
    });

    it("does not generate a Firebase password reset link", async () => {
      await emailProvider.sendDocumentEmail({ email: "staff@example.com" });

      expect(mockGeneratePasswordResetLink).not.toHaveBeenCalled();
    });
  });

  describe("sendPayslipEmail", () => {
    it("sends a notification with the hardcoded subject and a direct portal link", async () => {
      await emailProvider.sendPayslipEmail({ email: "staff@example.com" });

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith({
        from: "MDS Payroll <mock-continue-url>",
        to: "staff@example.com",
        subject: "Payslip Received!",
        html: '<a href="mock-continue-url">Click here</a>',
      });
    });

    it("does not generate a Firebase password reset link", async () => {
      await emailProvider.sendPayslipEmail({ email: "staff@example.com" });

      expect(mockGeneratePasswordResetLink).not.toHaveBeenCalled();
    });
  });
});
