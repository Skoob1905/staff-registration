import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import type { Auth, UserRecord } from "firebase-admin/auth";
import { ResetPasswordTokenManager } from "../ResetPasswordTokenManager";

const TOKEN_HEX_REGEX = /^[0-9a-f]{64}$/;

function createMockUser(overrides?: Partial<UserRecord>): UserRecord {
  return {
    uid: "test-uid-123",
    email: "user@example.com",
    emailVerified: false,
    disabled: false,
    metadata: { creationTime: "", lastSignInTime: null, lastRefreshTime: null },
    providerData: [],
    toJSON: () => ({}),
    ...overrides,
  } as UserRecord;
}

function createMockFirestore(
  initialDocs: Record<string, Record<string, unknown>> = {},
): {
  firestore: Firestore;
  docs: Record<string, Record<string, unknown>>;
} {
  const docs: Record<string, Record<string, unknown>> = { ...initialDocs };

  const applyFilters = (
    filters: Array<{ field: string; op: string; value: unknown }>,
  ): string[] => {
    return Object.entries(docs)
      .filter(([_, data]) =>
        filters.every(({ field, op, value }) => {
          const fieldValue = data[field];
          if (field === "expiresAt") {
            const tv = value as Timestamp;
            const fv = fieldValue as Timestamp;
            if (op === ">=") return fv.seconds >= tv.seconds;
            if (op === "<") return fv.seconds < tv.seconds;
            if (op === "==") return fv.seconds === tv.seconds;
            return true;
          }
          if (op === "==") return fieldValue === value;
          if (op === "in" && Array.isArray(value))
            return value.includes(fieldValue);
          return true;
        }),
      )
      .map(([id]) => id);
  };

  const createDocApi = () => {
    const filters: Array<{ field: string; op: string; value: unknown }> = [];

    const collectionObj = {
      doc: (id: string) => ({
        get: async () => {
          const doc = docs[id];
          return {
            exists: doc !== undefined,
            data: () => doc ?? null,
          };
        },
        set: async (data: Record<string, unknown>) => {
          docs[id] = data;
        },
        update: async (data: Record<string, unknown>) => {
          if (docs[id]) {
            docs[id] = { ...docs[id], ...data };
          }
        },
        delete: async () => {
          delete docs[id];
        },
      }),
      where: (field: string, op: string, value: unknown) => {
        filters.push({ field, op, value });
        return collectionObj;
      },
      get: async () => {
        const matchingIds =
          filters.length > 0 ? applyFilters(filters) : Object.keys(docs);
        return {
          empty: matchingIds.length === 0,
          size: matchingIds.length,
          docs: matchingIds.map((id) => ({
            id,
            ref: { id },
            data: () => docs[id],
          })),
          forEach: (
            cb: (doc: {
              id: string;
              ref: { id: string };
              data: () => Record<string, unknown>;
            }) => void,
          ) => {
            matchingIds.forEach((id) =>
              cb({ id, ref: { id }, data: () => docs[id] }),
            );
          },
        };
      },
    };

    return collectionObj;
  };

  const collection = vi.fn(() => createDocApi());
  const batch = vi.fn(() => {
    const pending: Array<{
      type: "update" | "delete" | "set";
      id: string;
      data?: Record<string, unknown>;
    }> = [];

    return {
      delete: vi.fn((ref: { id: string }) => {
        pending.push({ type: "delete", id: ref.id });
      }),
      update: vi.fn((ref: { id: string }, data: Record<string, unknown>) => {
        pending.push({ type: "update", id: ref.id, data });
      }),
      set: vi.fn((ref: { id: string }, data: Record<string, unknown>) => {
        pending.push({ type: "set", id: ref.id, data });
      }),
      commit: vi.fn(async () => {
        for (const op of pending) {
          if (op.type === "delete") {
            delete docs[op.id];
          } else if (op.type === "update") {
            if (docs[op.id]) docs[op.id] = { ...docs[op.id], ...op.data };
          } else if (op.type === "set") {
            docs[op.id] = op.data!;
          }
        }
        pending.length = 0;
      }),
    };
  });

  return {
    firestore: { collection, batch } as unknown as Firestore,
    docs,
  };
}

function createMockAuth(): Auth {
  const mockUser = createMockUser();

  return {
    getUserByEmail: vi.fn(async (email: string) => {
      if (email === "nonexistent@example.com") {
        throw new Error("USER_NOT_FOUND");
      }
      return mockUser;
    }),
    updateUser: vi.fn(async () => createMockUser()),
    revokeRefreshTokens: vi.fn(async () => {}),
  } as unknown as Auth;
}

describe("ResetPasswordTokenManager", () => {
  let manager: ResetPasswordTokenManager;
  let firestoreResult: ReturnType<typeof createMockFirestore>;
  let mockAuth: Auth;
  let referenceTime: Date;

  beforeEach(() => {
    vi.useFakeTimers();
    referenceTime = new Date("2026-07-15T12:00:00Z");
    vi.setSystemTime(referenceTime);

    firestoreResult = createMockFirestore();
    mockAuth = createMockAuth();

    manager = new ResetPasswordTokenManager(
      firestoreResult.firestore,
      mockAuth,
      "https://portal.com/reset-password",
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("createToken", () => {
    it("generates a 64-character hex string", async () => {
      const token = await manager.createToken("user@example.com");
      expect(token).toMatch(TOKEN_HEX_REGEX);
    });

    it("writes a doc to passwordResets/{token} with correct fields", async () => {
      const token = await manager.createToken("user@example.com");
      const doc = firestoreResult.docs[token];
      expect(doc).toBeDefined();
      expect(doc.uid).toBe("test-uid-123");
      expect(doc.email).toBe("user@example.com");
      expect(doc.createdAt).toBe(FieldValue.serverTimestamp());
      expect(doc.expiresAt).toBeInstanceOf(Timestamp);
    });

    it("expiresAt is ~120 hours (5 days) in the future by default", async () => {
      const token = await manager.createToken("user@example.com");
      const doc = firestoreResult.docs[token];
      const expiresAt = doc.expiresAt as Timestamp;
      const expected = Timestamp.fromDate(
        new Date(referenceTime.getTime() + 120 * 60 * 60 * 1000),
      );
      expect(expiresAt.seconds).toBe(expected.seconds);
    });

    it("expiresAt respects a custom expiryInHours", async () => {
      const token = await manager.createToken("user@example.com", 6);
      const doc = firestoreResult.docs[token];
      const expiresAt = doc.expiresAt as Timestamp;
      const expected = Timestamp.fromDate(
        new Date(referenceTime.getTime() + 6 * 60 * 60 * 1000),
      );
      expect(expiresAt.seconds).toBe(expected.seconds);
    });

    it("throws USER_NOT_FOUND when auth.getUserByEmail rejects", async () => {
      await expect(
        manager.createToken("nonexistent@example.com"),
      ).rejects.toThrow("USER_NOT_FOUND");
    });

    it("throws EMAIL_REQUIRED when email is empty", async () => {
      await expect(manager.createToken("")).rejects.toThrow("EMAIL_REQUIRED");
    });

    it("calls getUserByEmail with the provided email", async () => {
      await manager.createToken("user@example.com");
      expect(mockAuth.getUserByEmail).toHaveBeenCalledWith("user@example.com");
    });

    it("deletes existing unexpired tokens for the same user before creating a new one", async () => {
      const futureExpiry = Timestamp.fromDate(
        new Date(referenceTime.getTime() + 24 * 60 * 60 * 1000),
      );

      firestoreResult.docs["old-token"] = {
        uid: "test-uid-123",
        email: "user@example.com",
        expiresAt: futureExpiry,
        createdAt: FieldValue.serverTimestamp(),
      };

      const newToken = await manager.createToken("user@example.com");

      expect(firestoreResult.docs["old-token"]).toBeUndefined();
      expect(firestoreResult.docs[newToken]).toBeDefined();
    });

    it("does not delete expired tokens", async () => {
      firestoreResult.docs["expired-token"] = {
        uid: "test-uid-123",
        email: "user@example.com",
        expiresAt: Timestamp.fromDate(new Date(referenceTime.getTime() - 1)),
        createdAt: FieldValue.serverTimestamp(),
      };

      await manager.createToken("user@example.com");

      expect(firestoreResult.docs["expired-token"]).toBeDefined();
    });
  });

  describe("getResetLink", () => {
    it("calls createToken internally and returns full URL", async () => {
      const mockCreate = vi.spyOn(
        ResetPasswordTokenManager.prototype,
        "createToken",
      );

      const link = await manager.getResetLink("user@example.com");

      expect(mockCreate).toHaveBeenCalledWith("user@example.com", 120);
      expect(link).toMatch(
        /^https:\/\/portal\.com\/reset-password\?token=[0-9a-f]{64}$/,
      );

      const token = link.split("token=")[1];
      expect(firestoreResult.docs[token]).toBeDefined();

      mockCreate.mockRestore();
    });

    it("propagates errors from createToken", async () => {
      await expect(
        manager.getResetLink("nonexistent@example.com"),
      ).rejects.toThrow("USER_NOT_FOUND");
    });
  });

  describe("completeReset", () => {
    beforeEach(() => {
      const future = Timestamp.fromDate(
        new Date(referenceTime.getTime() + 24 * 60 * 60 * 1000),
      );
      firestoreResult.docs["valid-token"] = {
        uid: "test-uid-123",
        email: "user@example.com",
        expiresAt: future,
        createdAt: FieldValue.serverTimestamp(),
      };
    });

    it("throws INVALID_PASSWORD when password is too short", async () => {
      await expect(
        manager.completeReset("valid-token", "12345"),
      ).rejects.toThrow("INVALID_PASSWORD");
    });

    it("throws INVALID_PASSWORD when password is empty", async () => {
      await expect(manager.completeReset("valid-token", "")).rejects.toThrow(
        "INVALID_PASSWORD",
      );
    });

    it("throws INVALID_PASSWORD when password is too short — does not read Firestore or call Auth", async () => {
      await expect(
        manager.completeReset("valid-token", "12"),
      ).rejects.toThrow("INVALID_PASSWORD");

      const calls = (firestoreResult.firestore.collection as ReturnType<typeof vi.fn>).mock.calls as string[][];
      const passwordResetsCalls = calls.filter(
        ([name]) => name === "passwordResets",
      );
      expect(passwordResetsCalls).toHaveLength(0);
      expect(mockAuth.updateUser).not.toHaveBeenCalled();
    });

    it("throws INVALID_TOKEN when token doc does not exist — does not call updateUser", async () => {
      await expect(
        manager.completeReset("nonexistent-token", "newPassword123"),
      ).rejects.toThrow("INVALID_TOKEN");
      expect(mockAuth.updateUser).not.toHaveBeenCalled();
    });

    it("throws TOKEN_EXPIRED when token has expired — does not call updateUser", async () => {
      firestoreResult.docs["expired-token"] = {
        uid: "test-uid-123",
        email: "user@example.com",
        expiresAt: Timestamp.fromDate(new Date(referenceTime.getTime() - 1)),
        createdAt: FieldValue.serverTimestamp(),
      };

      await expect(
        manager.completeReset("expired-token", "newPassword123"),
      ).rejects.toThrow("TOKEN_EXPIRED");
      expect(mockAuth.updateUser).not.toHaveBeenCalled();
    });

    it("calls updateUser with the correct uid and password", async () => {
      await manager.completeReset("valid-token", "newPassword123");

      expect(mockAuth.updateUser).toHaveBeenCalledWith("test-uid-123", {
        password: "newPassword123",
      });
    });

    it("calls revokeRefreshTokens after updating password", async () => {
      await manager.completeReset("valid-token", "newPassword123");

      expect(mockAuth.revokeRefreshTokens).toHaveBeenCalledWith("test-uid-123");
    });

    it("deletes the token doc after successful reset", async () => {
      await manager.completeReset("valid-token", "newPassword123");

      expect(firestoreResult.docs["valid-token"]).toBeUndefined();
    });

    it("returns { uid, email } on successful reset", async () => {
      const result = await manager.completeReset(
        "valid-token",
        "newPassword123",
      );

      expect(result).toEqual({
        uid: "test-uid-123",
        email: "user@example.com",
      });
    });
  });

  describe("cleanupExpired", () => {
    it("deletes documents where expiresAt < now and removes them from the store", async () => {
      firestoreResult.docs["expired-1"] = {
        uid: "uid-1",
        email: "a@example.com",
        expiresAt: Timestamp.fromDate(
          new Date(referenceTime.getTime() - 60 * 60 * 1000),
        ),
        createdAt: FieldValue.serverTimestamp(),
      };
      firestoreResult.docs["expired-2"] = {
        uid: "uid-2",
        email: "b@example.com",
        expiresAt: Timestamp.fromDate(
          new Date(referenceTime.getTime() - 30 * 60 * 1000),
        ),
        createdAt: FieldValue.serverTimestamp(),
      };

      const count = await manager.cleanupExpired();

      expect(count).toBe(2);
      expect(firestoreResult.docs["expired-1"]).toBeUndefined();
      expect(firestoreResult.docs["expired-2"]).toBeUndefined();
    });

    it("does NOT delete unexpired documents", async () => {
      firestoreResult.docs["valid-token"] = {
        uid: "test-uid-123",
        email: "user@example.com",
        expiresAt: Timestamp.fromDate(
          new Date(referenceTime.getTime() + 24 * 60 * 60 * 1000),
        ),
        createdAt: FieldValue.serverTimestamp(),
      };

      const count = await manager.cleanupExpired();

      expect(count).toBe(0);
      expect(firestoreResult.docs["valid-token"]).toBeDefined();
    });

    it("returns 0 when no expired documents exist", async () => {
      const count = await manager.cleanupExpired();
      expect(count).toBe(0);
    });
  });
});
