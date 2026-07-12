import { describe, it, expect, vi, beforeEach } from "vitest";
import { match } from "../match";

const getStaff = vi.fn();

vi.mock("../../../services/firestore", () => ({
  getStaff: (id: string) => getStaff(id),
}));

describe("match", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("returns 'missing' when no staff document exists", async () => {
    getStaff.mockResolvedValue(null);

    const result = await match("John", "Smith", "MISSING_REF");

    expect(result).toEqual({ status: "missing" });
    expect(getStaff).toHaveBeenCalledWith("MISSING_REF");
  });

  it("returns 'matched' when firstname, lastname, and workerRef all match", async () => {
    getStaff.mockResolvedValue({
      id: "ABC123",
      Forename: "John",
      Surname: "Smith",
      email: "john@example.com",
      agencyId: "ag_xyz",
    });

    const result = await match("John", "Smith", "ABC123");

    expect(result).toEqual({
      status: "matched",
      workerRef: "ABC123",
      email: "john@example.com",
      agencyId: "ag_xyz",
    });
  });

  it("matches case-insensitively (mixed case)", async () => {
    getStaff.mockResolvedValue({
      id: "REF001",
      Forename: "Jane",
      Surname: "Doe",
      email: "jane@example.com",
      agencyId: "ag_a",
    });

    const result = await match("jane", "DOE", "REF001");

    expect(result).toEqual({
      status: "matched",
      workerRef: "REF001",
      email: "jane@example.com",
      agencyId: "ag_a",
    });
  });

  it("matches case-insensitively (doc fields are lowercase, input is uppercase)", async () => {
    getStaff.mockResolvedValue({
      id: "REF002",
      Forename: "alice",
      Surname: "brown",
      email: "alice@example.com",
      agencyId: "ag_b",
    });

    const result = await match("ALICE", "BROWN", "REF002");

    expect(result).toEqual({
      status: "matched",
      workerRef: "REF002",
      email: "alice@example.com",
      agencyId: "ag_b",
    });
  });

  it("returns 'wrong info' when firstname differs", async () => {
    getStaff.mockResolvedValue({
      id: "REF003",
      Forename: "Robert",
      Surname: "Smith",
      email: "robert@example.com",
      agencyId: "ag_c",
    });

    const result = await match("Bob", "Smith", "REF003");

    expect(result).toEqual({
      status: "wrong info",
      workerRef: "REF003",
      email: "robert@example.com",
      agencyId: "ag_c",
    });
  });

  it("returns 'wrong info' when lastname differs", async () => {
    getStaff.mockResolvedValue({
      id: "REF004",
      Forename: "Mary",
      Surname: "Jones",
      email: "mary@example.com",
      agencyId: "ag_d",
    });

    const result = await match("Mary", "Johnson", "REF004");

    expect(result).toEqual({
      status: "wrong info",
      workerRef: "REF004",
      email: "mary@example.com",
      agencyId: "ag_d",
    });
  });

  it("returns 'wrong info' when both names differ", async () => {
    getStaff.mockResolvedValue({
      id: "REF005",
      Forename: "Tom",
      Surname: "Hardy",
      email: "tom@example.com",
      agencyId: "ag_e",
    });

    const result = await match("Not", "Tom", "REF005");

    expect(result).toEqual({
      status: "wrong info",
      workerRef: "REF005",
      email: "tom@example.com",
      agencyId: "ag_e",
    });
  });

  it("returns email and agencyId as undefined when doc is missing those fields", async () => {
    getStaff.mockResolvedValue({
      id: "REF006",
      Forename: "Sam",
      Surname: "Green",
    });

    const result = await match("Sam", "Green", "REF006");

    expect(result).toEqual({
      status: "matched",
      workerRef: "REF006",
      email: undefined,
      agencyId: undefined,
    });
  });

  it("returns 'wrong info' when Forename and Surname fields are missing from the doc", async () => {
    getStaff.mockResolvedValue({
      id: "REF007",
      email: "no-name@example.com",
      agencyId: "ag_f",
    });

    const result = await match("Any", "Name", "REF007");

    expect(result).toEqual({
      status: "wrong info",
      workerRef: "REF007",
      email: "no-name@example.com",
      agencyId: "ag_f",
    });
  });

  it("returns 'wrong info' when Forename and Surname are non-string values", async () => {
    getStaff.mockResolvedValue({
      id: "REF008",
      Forename: 123,
      Surname: null,
      email: "bad@example.com",
      agencyId: "ag_g",
    });

    const result = await match("John", "Smith", "REF008");

    expect(result).toEqual({
      status: "wrong info",
      workerRef: "REF008",
      email: "bad@example.com",
      agencyId: "ag_g",
    });
  });

  it("matches when workerRef differs only in case", async () => {
    getStaff
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "abc789",
        Forename: "Kate",
        Surname: "Lee",
        email: "kate@example.com",
        agencyId: "ag_h",
      });

    const result = await match("Kate", "Lee", "ABC789");

    expect(result).toEqual({
      status: "matched",
      workerRef: "abc789",
      email: "kate@example.com",
      agencyId: "ag_h",
    });
  });

  it("returns 'missing' when all three case variants fail", async () => {
    getStaff.mockResolvedValue(null);

    const result = await match("Any", "One", "NoMatch");

    expect(result).toEqual({ status: "missing" });
  });
});
