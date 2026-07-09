import { describe, it, expect, vi } from "vitest";
import type { Firestore } from "firebase-admin/firestore";
import { revokeApiKeyLogic } from "../revokeApiKey.js";

describe("revokeApiKeyLogic", () => {
  it("deletes the document matching the label", async () => {
    const batchDelete = vi.fn();
    const batchCommit = vi.fn().mockResolvedValue(undefined);

    const db = {
      collection: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({
              empty: false,
              size: 1,
              docs: [{ id: "key-to-delete", ref: { id: "key-to-delete" } }],
              forEach: (cb: (doc: { id: string; ref: { id: string } }) => void) => {
                cb({ id: "key-to-delete", ref: { id: "key-to-delete" } });
              },
            }),
          })),
        })),
      })),
      batch: vi.fn(() => ({
        delete: batchDelete,
        set: vi.fn(),
        commit: batchCommit,
      })),
    } as unknown as Firestore;

    await revokeApiKeyLogic(db, "My Provider");

    expect(batchDelete).toHaveBeenCalled();
    expect(batchCommit).toHaveBeenCalled();
  });

  it("does nothing if no key with that label exists", async () => {
    const batchDelete = vi.fn();
    const batchCommit = vi.fn();

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
      })),
      batch: vi.fn(() => ({
        delete: batchDelete,
        set: vi.fn(),
        commit: batchCommit,
      })),
    } as unknown as Firestore;

    await revokeApiKeyLogic(db, "Non Existent");

    expect(batchDelete).not.toHaveBeenCalled();
    expect(batchCommit).not.toHaveBeenCalled();
  });
});
