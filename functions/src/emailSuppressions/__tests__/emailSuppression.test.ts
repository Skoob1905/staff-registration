import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Firestore } from "firebase-admin/firestore";
import { EmailSuppressionManager } from "../EmailSuppressionManager";
import { successHtml, errorHtml } from "../unsubscribePage";
import { isValidSender, isValidEmail } from "../types";

function createMockFirestore(): Firestore {
  const store = new Map<string, Map<string, Record<string, unknown>>>();

  const makeWhere = () => ({
    where: vi.fn(() => makeWhere()),
    get: vi.fn().mockResolvedValue({ empty: true, docs: [], forEach: vi.fn() }),
  });

  return {
    collection: vi.fn((path: string) => {
      const parts = path.split("/");
      return {
        doc: vi.fn((id: string) => {
          const fullPath = `${parts.join("/")}/${id}`;
          return {
            get: vi.fn(async () => {
              const docData = store.get(fullPath);
              return {
                exists: docData !== undefined,
                data: () => (docData ? Object.fromEntries(docData) : undefined),
                id,
              };
            }),
            set: vi.fn(async (data: Record<string, unknown>) => {
              const sub = new Map<string, Record<string, unknown>>();
              for (const [k, v] of Object.entries(data)) {
                sub.set(k, v as Record<string, unknown>);
              }
              store.set(fullPath, sub);
            }),
            update: vi.fn(async (data: Record<string, unknown>) => {
              const existing = store.get(fullPath) ?? new Map();
              for (const [k, v] of Object.entries(data)) {
                existing.set(k, v as Record<string, unknown>);
              }
              store.set(fullPath, existing);
            }),
            delete: vi.fn(async () => {
              store.delete(fullPath);
            }),
            collection: vi.fn((subPath: string) => {
              const subColPath = `${fullPath}/${subPath}`;
              return {
                doc: vi.fn((subId: string) => {
                  const subDocPath = `${subColPath}/${subId}`;
                  return {
                    get: vi.fn(async () => {
                      const docData = store.get(subDocPath);
                      return {
                        exists: docData !== undefined,
                        data: () =>
                          docData
                            ? Object.fromEntries(docData)
                            : undefined,
                        id: subId,
                      };
                    }),
                    set: vi.fn(
                      async (data: Record<string, unknown>) => {
                        const sub = new Map<
                          string,
                          Record<string, unknown>
                        >();
                        for (const [k, v] of Object.entries(data)) {
                          sub.set(k, v as Record<string, unknown>);
                        }
                        store.set(subDocPath, sub);
                      },
                    ),
                    delete: vi.fn(async () => {
                      store.delete(subDocPath);
                    }),
                  };
                }),
                get: vi.fn(async () => {
                  const docs: { id: string }[] = [];
                  for (const [key] of store) {
                    if (key.startsWith(subColPath + "/")) {
                      docs.push({ id: key.split("/").pop() ?? "" });
                    }
                  }
                  return { docs, empty: docs.length === 0, forEach: vi.fn() };
                }),
              };
            }),
          };
        }),
        where: vi.fn(() => makeWhere()),
      };
    }),
    batch: vi.fn(),
    runTransaction: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as Firestore;
}

describe("EmailSuppressionManager", () => {
  let manager: EmailSuppressionManager;
  let mockDb: Firestore;

  beforeEach(() => {
    mockDb = createMockFirestore();
    manager = new EmailSuppressionManager(mockDb);
  });

  describe("add", () => {
    it("creates a suppression doc for the given email + sender", async () => {
      await manager.add("user@example.com", "payslips", "unsubscribed");

      const result = await manager.isSuppressed("user@example.com", "payslips");
      expect(result).toBe(true);
    });

    it("lowercases the email address", async () => {
      await manager.add("USER@Example.COM", "registration", "unsubscribed");

      const result = await manager.isSuppressed("user@example.com", "registration");
      expect(result).toBe(true);
    });

    it("can suppress multiple senders for the same email", async () => {
      await manager.add("user@example.com", "payslips", "unsubscribed");
      await manager.add("user@example.com", "documents", "unsubscribed");

      expect(await manager.isSuppressed("user@example.com", "payslips")).toBe(true);
      expect(await manager.isSuppressed("user@example.com", "documents")).toBe(true);
      expect(await manager.isSuppressed("user@example.com", "registration")).toBe(false);
    });
  });

  describe("remove", () => {
    it("deletes a suppression doc for the given email + sender", async () => {
      await manager.add("user@example.com", "payslips", "unsubscribed");
      await manager.remove("user@example.com", "payslips");

      const result = await manager.isSuppressed("user@example.com", "payslips");
      expect(result).toBe(false);
    });
  });

  describe("isSuppressed", () => {
    it("returns true when a suppression doc exists", async () => {
      await manager.add("user@example.com", "registration", "unsubscribed");

      const result = await manager.isSuppressed("user@example.com", "registration");
      expect(result).toBe(true);
    });

    it("returns false when no suppression doc exists", async () => {
      const result = await manager.isSuppressed("unknown@example.com", "payslips");
      expect(result).toBe(false);
    });

    it("does not block a different sender when one sender is suppressed", async () => {
      await manager.add("user@example.com", "payslips", "unsubscribed");

      const documentsSuppressed = await manager.isSuppressed("user@example.com", "documents");
      const registrationSuppressed = await manager.isSuppressed("user@example.com", "registration");

      expect(documentsSuppressed).toBe(false);
      expect(registrationSuppressed).toBe(false);
    });
  });

  describe("list", () => {
    it("returns all suppressed senders for an email", async () => {
      await manager.add("user@example.com", "payslips", "unsubscribed");
      await manager.add("user@example.com", "documents", "bounce");

      const senders = await manager.list("user@example.com");

      expect(senders).toContain("payslips");
      expect(senders).toContain("documents");
      expect(senders).not.toContain("registration");
    });

    it("returns an empty array when nothing is suppressed", async () => {
      const senders = await manager.list("nobody@example.com");
      expect(senders).toEqual([]);
    });
  });
});

describe("unsubscribePage", () => {
  describe("successHtml", () => {
    it("includes the email and sender in the page", () => {
      const html = successHtml("user@example.com", "payslips");
      expect(html).toContain("user@example.com");
      expect(html).toContain("payslips");
      expect(html).toContain("Unsubscribed");
    });

    it("escapes HTML in the email address", () => {
      const html = successHtml("<script>alert('xss')</script>", "payslips");
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    });
  });

  describe("errorHtml", () => {
    it("includes the error message in the page", () => {
      const html = errorHtml("Missing email parameter.");
      expect(html).toContain("Missing email parameter.");
      expect(html).toContain("Something went wrong");
    });
  });
});

describe("types", () => {
  describe("isValidSender", () => {
    it("returns true for valid senders", () => {
      expect(isValidSender("registration")).toBe(true);
      expect(isValidSender("payslips")).toBe(true);
      expect(isValidSender("documents")).toBe(true);
    });

    it("returns false for invalid senders", () => {
      expect(isValidSender("")).toBe(false);
      expect(isValidSender("unknown")).toBe(false);
      expect(isValidSender("admin")).toBe(false);
    });
  });

  describe("isValidEmail", () => {
    it("returns true for valid emails", () => {
      expect(isValidEmail("user@example.com")).toBe(true);
      expect(isValidEmail("test+tag@domain.co.uk")).toBe(true);
    });

    it("returns false for invalid emails", () => {
      expect(isValidEmail("")).toBe(false);
      expect(isValidEmail("not-email")).toBe(false);
      expect(isValidEmail("@domain.com")).toBe(false);
    });
  });
});
