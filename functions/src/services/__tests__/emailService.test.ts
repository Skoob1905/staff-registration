import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockSendMail } = vi.hoisted(() => ({
  mockSendMail: vi.fn().mockResolvedValue(true),
}));

const { mockCreateTransport } = vi.hoisted(() => ({
  mockCreateTransport: vi.fn(() => ({
    sendMail: mockSendMail,
  })),
}));

const { mockGetAuth, mockGetUserByEmail } = vi.hoisted(() => {
  const getUserByEmail = vi.fn().mockResolvedValue({ uid: "mock-uid" });
  return {
    mockGetAuth: vi.fn(() => ({ getUserByEmail })),
    mockGetUserByEmail: getUserByEmail,
  };
});

const { mockGetFirestore } = vi.hoisted(() => {
  const makeWhere = () => ({
    where: vi.fn(() => makeWhere()),
    get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
  });
  return {
    mockGetFirestore: vi.fn(() => ({
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          set: vi.fn().mockResolvedValue(undefined),
          update: vi.fn().mockResolvedValue(undefined),
        })),
        where: vi.fn(() => makeWhere()),
      })),
    })),
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

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: mockGetFirestore,
  FieldValue: {
    serverTimestamp: vi.fn(() => "mock-timestamp"),
  },
  Timestamp: {
    fromDate: vi.fn(() => ({ seconds: 9999999999 })),
    now: vi.fn(() => ({ seconds: 9999999999 })),
  },
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

  describe("reset link generation", () => {
    it("generates a custom token link via ResetPasswordTokenManager", async () => {
      const link = await emailProvider["tokenManager"]().getResetLink(
        "user@example.com",
      );

      expect(link).toContain("mock-continue-url/reset-password?token=");
      expect(link.length).toBeGreaterThan(
        "mock-continue-url/reset-password?token=".length,
      );
    });

    it("throws when email has no Firebase Auth user", async () => {
      mockGetUserByEmail.mockRejectedValueOnce(new Error("EMAIL_NOT_FOUND"));

      await expect(
        emailProvider["tokenManager"]().getResetLink("bad@example.com"),
      ).rejects.toThrow("EMAIL_NOT_FOUND");
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
    it("generates a custom token link, reads registration.html, replaces {{link}}, and sends the email", async () => {
      await emailProvider.sendWorkerRegistrationLink("worker@example.com");

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.from).toBe("MDS Payroll <mock-continue-url>");
      expect(callArgs.to).toBe("worker@example.com");
      expect(callArgs.subject).toBe("Welcome to MDS");
      expect(callArgs.html).toContain(
        "mock-continue-url/reset-password?token=",
      );
    });

    it("throws when email has no Firebase Auth user", async () => {
      mockGetUserByEmail.mockRejectedValueOnce(new Error("EMAIL_NOT_FOUND"));

      await expect(
        emailProvider.sendWorkerRegistrationLink("missing@example.com"),
      ).rejects.toThrow("EMAIL_NOT_FOUND");
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
    it("generates a custom token link, reads agencyRegistration.html, replaces {{link}}, and sends the email", async () => {
      await emailProvider.sendAgencyRegistrationLink("agency@example.com");

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.from).toBe("MDS Payroll <mock-continue-url>");
      expect(callArgs.to).toBe("agency@example.com");
      expect(callArgs.subject).toBe("Welcome to MDS");
      expect(callArgs.html).toContain(
        "mock-continue-url/reset-password?token=",
      );
    });

    it("throws when email has no Firebase Auth user", async () => {
      mockGetUserByEmail.mockRejectedValueOnce(new Error("EMAIL_NOT_FOUND"));

      await expect(
        emailProvider.sendAgencyRegistrationLink("missing@example.com"),
      ).rejects.toThrow("EMAIL_NOT_FOUND");
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
    it("generates a custom token link, reads clientRegistration.html, replaces {{link}}, and sends the email", async () => {
      await emailProvider.sendClientRegistrationLink("client@example.com");

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.from).toBe("MDS Payroll <mock-continue-url>");
      expect(callArgs.to).toBe("client@example.com");
      expect(callArgs.subject).toBe("Welcome to MDS");
      expect(callArgs.html).toContain(
        "mock-continue-url/reset-password?token=",
      );
    });

    it("throws when email has no Firebase Auth user", async () => {
      mockGetUserByEmail.mockRejectedValueOnce(new Error("EMAIL_NOT_FOUND"));

      await expect(
        emailProvider.sendClientRegistrationLink("missing@example.com"),
      ).rejects.toThrow("EMAIL_NOT_FOUND");
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
