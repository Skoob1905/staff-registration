import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockSendMail } = vi.hoisted(() => ({
  mockSendMail: vi.fn().mockResolvedValue(true),
}));

const { mockCreateTransport } = vi.hoisted(() => ({
  mockCreateTransport: vi.fn(() => ({
    sendMail: mockSendMail,
  })),
}));

const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));

const { mockGetAuth, mockGeneratePasswordResetLink } = vi.hoisted(() => {
  const fn = vi.fn(() =>
    Promise.resolve("https://mock.link?oobCode=abc123&apiKey=my-api-key"),
  );
  return {
    mockGetAuth: vi.fn(() => ({
      generatePasswordResetLink: fn,
    })),
    mockGeneratePasswordResetLink: fn,
  };
});

const { mockReadFileSync } = vi.hoisted(() => ({
  mockReadFileSync: vi.fn(() => '<a href="{{link}}">Click here</a>'),
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: mockCreateTransport,
  },
}));

vi.mock("firebase-functions/params", () => ({
  defineString: vi.fn(() => ({
    value: vi.fn(() => "mock-continue-url"),
  })),
  defineBoolean: vi.fn(() => ({
    value: vi.fn(() => true),
  })),
}));

vi.mock("firebase-admin/auth", () => ({
  getAuth: mockGetAuth,
}));

vi.mock("node:fs", () => ({
  default: {
    readFileSync: mockReadFileSync,
  },
}));

import { EmailProvider } from "../EmailService";

describe("EmailProvider", () => {
  let emailProvider: EmailProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReadFileSync.mockReturnValue('<a href="{{link}}">Click here</a>');
    mockSendMail.mockResolvedValue(true);
    mockGeneratePasswordResetLink.mockResolvedValue(
      "https://mock.link?oobCode=abc123&apiKey=my-api-key",
    );
    globalThis.fetch = mockFetch;
    emailProvider = new EmailProvider();
  });

  describe("constructor", () => {
    it("creates an EmailProvider instance and configures SMTP transport", () => {
      expect(emailProvider).toBeInstanceOf(EmailProvider);

      expect(mockCreateTransport).toHaveBeenCalledTimes(1);
      expect(mockCreateTransport).toHaveBeenCalledWith({
        host: "mock-continue-url",
        port: NaN,
        auth: { user: "mock-continue-url", pass: "mock-continue-url" },
      });
    });
  });

  describe("generatePasswordResetLink", () => {
    it("calls getAuth().generatePasswordResetLink and returns the link", async () => {
      const result = await emailProvider.generatePasswordResetLink(
        "user@example.com",
      );

      expect(mockGeneratePasswordResetLink).toHaveBeenCalledTimes(1);
      expect(mockGeneratePasswordResetLink).toHaveBeenCalledWith(
        "user@example.com",
        { url: "mock-continue-url", handleCodeInApp: true },
      );
      expect(result).toBe(
        "https://mock.link?oobCode=abc123&apiKey=my-api-key",
      );
    });

    it("throws when getAuth().generatePasswordResetLink rejects", async () => {
      mockGeneratePasswordResetLink.mockRejectedValueOnce(
        new Error("EMAIL_NOT_FOUND"),
      );

      await expect(
        emailProvider.generatePasswordResetLink("bad@example.com"),
      ).rejects.toThrow("EMAIL_NOT_FOUND");
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

    it("propagates errors from generatePasswordResetLink", async () => {
      mockGeneratePasswordResetLink.mockRejectedValueOnce(
        new Error("OPERATION_NOT_ALLOWED"),
      );

      await expect(
        emailProvider.generatePortalResetLink("missing@example.com"),
      ).rejects.toThrow("OPERATION_NOT_ALLOWED");
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

    it("calls the callback 100 times with 1-second intervals and returns success result", async () => {
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

      const result = await promise;

      expect(result).toEqual({ sent: 100, failed: 0, failures: [] });
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

    it("returns zero counts for an empty array", async () => {
      const callback = vi.fn().mockResolvedValue(undefined);

      const result = await emailProvider.beginBatchEmailSend([], callback);

      expect(result).toEqual({ sent: 0, failed: 0, failures: [] });
      expect(callback).not.toHaveBeenCalled();
    });

    it("calls once with no timer delay and returns success for a single email", async () => {
      const callback = vi.fn().mockResolvedValue(undefined);
      const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

      const result = await emailProvider.beginBatchEmailSend(
        ["single@example.com"],
        callback,
      );

      expect(result).toEqual({ sent: 1, failed: 0, failures: [] });
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({ email: "single@example.com" });
      expect(setTimeoutSpy).not.toHaveBeenCalled();

      setTimeoutSpy.mockRestore();
    });

    it("collects failures and continues processing remaining emails", async () => {
      const callback = vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("send failure"))
        .mockResolvedValue(undefined);
      const emails = ["a@example.com", "b@example.com", "c@example.com"];

      const promise = emailProvider.beginBatchEmailSend(emails, callback);

      for (let i = 0; i < 3; i++) {
        await vi.advanceTimersByTimeAsync(1000);
      }

      const result = await promise;

      expect(result.sent).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.failures).toEqual([
        { email: "b@example.com", error: "send failure" },
      ]);
      expect(callback).toHaveBeenCalledTimes(3);
    });

    it("returns all failures when every callback fails", async () => {
      const callback = vi.fn().mockRejectedValue(new Error("down"));
      const emails = ["a@example.com", "b@example.com"];

      const promise = emailProvider.beginBatchEmailSend(emails, callback);

      for (let i = 0; i < 2; i++) {
        await vi.advanceTimersByTimeAsync(1000);
      }

      const result = await promise;

      expect(result).toEqual({
        sent: 0,
        failed: 2,
        failures: [
          { email: "a@example.com", error: "down" },
          { email: "b@example.com", error: "down" },
        ],
      });
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it("maintains 1-second delay even when callbacks fail", async () => {
      const callback = vi
        .fn()
        .mockRejectedValueOnce(new Error("fail"))
        .mockRejectedValueOnce(new Error("fail"))
        .mockResolvedValueOnce(undefined);
      const emails = ["a@example.com", "b@example.com", "c@example.com"];
      const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

      const promise = emailProvider.beginBatchEmailSend(emails, callback);

      for (let i = 0; i < 3; i++) {
        await vi.advanceTimersByTimeAsync(1000);
      }

      await promise;

      expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
      expect(setTimeoutSpy).toHaveBeenNthCalledWith(
        1,
        expect.any(Function),
        1000,
      );
      expect(setTimeoutSpy).toHaveBeenNthCalledWith(
        2,
        expect.any(Function),
        1000,
      );

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

    it("throws when the password reset link generation fails", async () => {
      mockGeneratePasswordResetLink.mockRejectedValueOnce(
        new Error("auth/internal-error"),
      );

      await expect(
        emailProvider.sendWorkerRegistrationLink("worker@example.com"),
      ).rejects.toThrow("auth/internal-error");
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it("throws when the SMTP send fails", async () => {
      mockSendMail.mockRejectedValueOnce(new Error("SMTP error"));

      await expect(
        emailProvider.sendWorkerRegistrationLink("worker@example.com"),
      ).rejects.toThrow("SMTP error");
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

    it("throws when the password reset link generation fails", async () => {
      mockGeneratePasswordResetLink.mockRejectedValueOnce(
        new Error("auth/internal-error"),
      );

      await expect(
        emailProvider.sendAgencyRegistrationLink("agency@example.com"),
      ).rejects.toThrow("auth/internal-error");
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it("throws when the SMTP send fails", async () => {
      mockSendMail.mockRejectedValueOnce(new Error("SMTP error"));

      await expect(
        emailProvider.sendAgencyRegistrationLink("agency@example.com"),
      ).rejects.toThrow("SMTP error");
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

    it("throws when the password reset link generation fails", async () => {
      mockGeneratePasswordResetLink.mockRejectedValueOnce(
        new Error("auth/internal-error"),
      );

      await expect(
        emailProvider.sendClientRegistrationLink("client@example.com"),
      ).rejects.toThrow("auth/internal-error");
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it("throws when the SMTP send fails", async () => {
      mockSendMail.mockRejectedValueOnce(new Error("SMTP error"));

      await expect(
        emailProvider.sendClientRegistrationLink("client@example.com"),
      ).rejects.toThrow("SMTP error");
    });
  });

  describe("sendResetPassword", () => {
    it("sends the email with the provided reset link in the template", async () => {
      await emailProvider.sendResetPassword(
        "user@example.com",
        "https://portal.com/reset-password?token=abc123",
      );

      expect(mockGeneratePasswordResetLink).not.toHaveBeenCalled();
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith({
        from: "MDS Payroll <mock-continue-url>",
        to: "user@example.com",
        subject: "Reset your password",
        html: '<a href="https://portal.com/reset-password?token=abc123">Click here</a>',
      });
    });

    it("skips sending when resetLink is empty", async () => {
      await emailProvider.sendResetPassword("user@example.com", "");

      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it("throws when the SMTP send fails", async () => {
      mockSendMail.mockRejectedValueOnce(new Error("SMTP error"));

      await expect(
        emailProvider.sendResetPassword(
          "user@example.com",
          "https://portal.com/reset-password?token=abc123",
        ),
      ).rejects.toThrow("SMTP error");
    });

    it("throws when the template file is missing", async () => {
      mockReadFileSync.mockImplementationOnce(() => {
        throw new Error("ENOENT: no such file");
      });

      await expect(
        emailProvider.sendResetPassword(
          "user@example.com",
          "https://portal.com/reset-password?token=abc123",
        ),
      ).rejects.toThrow("ENOENT");
      expect(mockSendMail).not.toHaveBeenCalled();
    });
  });

  describe("sendDocumentEmail", () => {
    it("sends a notification with the hardcoded subject and a direct portal link", async () => {
      await emailProvider.sendDocumentEmail("staff@example.com");

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith({
        from: "MDS Payroll <mock-continue-url>",
        to: "staff@example.com",
        subject: "Document Uploaded!",
        html: '<a href="mock-continue-url">Click here</a>',
      });
    });

    it("does not generate a Firebase password reset link", async () => {
      await emailProvider.sendDocumentEmail("staff@example.com");

      expect(mockGeneratePasswordResetLink).not.toHaveBeenCalled();
    });

    it("throws when the SMTP send fails", async () => {
      mockSendMail.mockRejectedValueOnce(new Error("SMTP error"));

      await expect(
        emailProvider.sendDocumentEmail("staff@example.com"),
      ).rejects.toThrow("SMTP error");
    });

    it("throws when the template file is missing", async () => {
      mockReadFileSync.mockImplementationOnce(() => {
        throw new Error("ENOENT: no such file");
      });

      await expect(
        emailProvider.sendDocumentEmail("staff@example.com"),
      ).rejects.toThrow("ENOENT");
      expect(mockSendMail).not.toHaveBeenCalled();
    });
  });

  describe("sendPayslipEmail", () => {
    it("sends a notification with the hardcoded subject and a direct portal link", async () => {
      await emailProvider.sendPayslipEmail("staff@example.com");

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith({
        from: "MDS Payroll <mock-continue-url>",
        to: "staff@example.com",
        subject: "Payslip Received!",
        html: '<a href="mock-continue-url">Click here</a>',
      });
    });

    it("does not generate a Firebase password reset link", async () => {
      await emailProvider.sendPayslipEmail("staff@example.com");

      expect(mockGeneratePasswordResetLink).not.toHaveBeenCalled();
    });

    it("throws when the SMTP send fails", async () => {
      mockSendMail.mockRejectedValueOnce(new Error("SMTP error"));

      await expect(
        emailProvider.sendPayslipEmail("staff@example.com"),
      ).rejects.toThrow("SMTP error");
    });

    it("throws when the template file is missing", async () => {
      mockReadFileSync.mockImplementationOnce(() => {
        throw new Error("ENOENT: no such file");
      });

      await expect(
        emailProvider.sendPayslipEmail("staff@example.com"),
      ).rejects.toThrow("ENOENT");
      expect(mockSendMail).not.toHaveBeenCalled();
    });
  });
});
