import { describe, it, expect, vi } from "vitest";
import type { Firestore } from "firebase-admin/firestore";
import { generateApiKeyLogic } from "../generateApiKey.js";

function createMockDb(overrides?: {
  existingDocs?: Array<{ id: string }>;
}): Firestore {
  const existingDocs = overrides?.existingDocs ?? [];

  const mockQuerySnapshot = {
    empty: existingDocs.length === 0,
    size: existingDocs.length,
    docs: existingDocs.map((d) => ({ id: d.id, ref: { id: d.id } })),
    forEach: (cb: (doc: { id: string; ref: { id: string } }) => void) => {
      existingDocs.forEach((d) => cb({ id: d.id, ref: { id: d.id } }));
    },
  };

  const mockGet = vi.fn().mockResolvedValue(mockQuerySnapshot);
  const mockLimit = vi.fn(() => ({ get: mockGet }));
  const mockWhere = vi.fn(() => ({ where: mockWhere, limit: mockLimit }));
  const mockDoc = vi.fn(() => ({ id: "new-key-doc-id" }));

  const batchDelete = vi.fn();
  const batchSet = vi.fn();
  const batchCommit = vi.fn().mockResolvedValue(undefined);

  return {
    collection: vi.fn(() => ({
      where: mockWhere,
      doc: mockDoc,
    })),
    batch: vi.fn(() => ({
      delete: batchDelete,
      set: batchSet,
      commit: batchCommit,
    })),
  } as unknown as Firestore;
}

describe("generateApiKeyLogic", () => {
  it("creates a new key when no existing key with that label", async () => {
    const db = createMockDb({ existingDocs: [] });
    const result = await generateApiKeyLogic(db, "My Provider");

    expect(result).toHaveProperty("apiKey");
    expect(result).toHaveProperty("id", "new-key-doc-id");
    expect(typeof result.apiKey).toBe("string");
    expect(result.apiKey).toMatch(/^[A-Za-z0-9]{10}$/);
  });

  it("deletes existing key with same label before creating new one", async () => {
    const mockQuerySnapshot = {
      empty: false,
      size: 1,
      docs: [{ id: "old-key-id", ref: { id: "old-key-id" } }],
      forEach: (cb: (doc: { id: string; ref: { id: string } }) => void) => {
        cb({ id: "old-key-id", ref: { id: "old-key-id" } });
      },
    };

    const batchDelete = vi.fn();
    const batchSet = vi.fn();
    const batchCommit = vi.fn().mockResolvedValue(undefined);

    const db = {
      collection: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => ({
            get: vi.fn().mockResolvedValue(mockQuerySnapshot),
          })),
        })),
        doc: vi.fn(() => ({ id: "new-key-doc-id" })),
      })),
      batch: vi.fn(() => ({
        delete: batchDelete,
        set: batchSet,
        commit: batchCommit,
      })),
    } as unknown as Firestore;

    await generateApiKeyLogic(db, "My Provider");

    expect(batchDelete).toHaveBeenCalled();
    expect(batchSet).toHaveBeenCalled();
    expect(batchCommit).toHaveBeenCalled();
  });

  it("stores apiKey, label, expiresAt, and lastUsedAt on the new doc", async () => {
    let setCallArgs: unknown = null;

    const db = {
      collection: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({
              empty: true,
              size: 0,
              docs: [],
              forEach: () => {},
            }),
          })),
        })),
        doc: vi.fn(() => ({ id: "new-key-doc-id" })),
      })),
      batch: vi.fn(() => ({
        delete: vi.fn(),
        set: (...args: unknown[]) => {
          setCallArgs = args;
        },
        commit: vi.fn().mockResolvedValue(undefined),
      })),
    } as unknown as Firestore;

    await generateApiKeyLogic(db, "My Provider");

    expect(setCallArgs).not.toBeNull();
    const [, data] = setCallArgs as [unknown, Record<string, unknown>];
    expect(data).toHaveProperty("apiKey");
    expect(data).toHaveProperty("label", "My Provider");
    expect(data).toHaveProperty("expiresAt");
    expect(data).toHaveProperty("lastUsedAt");
    expect(data.lastUsedAt).toBeNull();
  });

  it("throws if label is empty", async () => {
    const db = createMockDb();
    await expect(generateApiKeyLogic(db, "")).rejects.toThrow("label is required");
  });
});
