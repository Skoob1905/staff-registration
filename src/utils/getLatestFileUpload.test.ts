import { describe, it, expect } from "vitest";
import {
  getLatestTimesheetUpload,
  formatTimesheetDate,
  type TimesheetEntry,
} from "./timesheets";

describe("getLatestTimesheetUpload", () => {
  it("returns null for empty array", () => {
    expect(getLatestTimesheetUpload([])).toBeNull();
  });

  it("returns the only entry when there's one", () => {
    const entry: TimesheetEntry = {
      uploadedBy: "alice",
      uploadedAt: "2025-01-01T12:00:00Z",
      fileName: "jan.pdf",
      fileUrl: "https://example.com/jan.pdf",
    };
    expect(getLatestTimesheetUpload([entry])).toEqual(entry);
  });

  it("returns the most recent from multiple entries", () => {
    const older: TimesheetEntry = {
      uploadedBy: "alice",
      uploadedAt: "2025-01-01T12:00:00Z",
      fileName: "jan.pdf",
      fileUrl: "https://example.com/jan.pdf",
    };
    const newer: TimesheetEntry = {
      uploadedBy: "bob",
      uploadedAt: "2025-06-01T12:00:00Z",
      fileName: "jun.pdf",
      fileUrl: "https://example.com/jun.pdf",
    };
    expect(getLatestTimesheetUpload([older, newer])).toEqual(newer);
  });

  it("handles out-of-order entries", () => {
    const a: TimesheetEntry = {
      uploadedBy: "alice",
      uploadedAt: "2025-03-01T12:00:00Z",
      fileName: "mar.pdf",
      fileUrl: "https://example.com/mar.pdf",
    };
    const b: TimesheetEntry = {
      uploadedBy: "bob",
      uploadedAt: "2025-01-01T12:00:00Z",
      fileName: "jan.pdf",
      fileUrl: "https://example.com/jan.pdf",
    };
    const c: TimesheetEntry = {
      uploadedBy: "carol",
      uploadedAt: "2025-06-01T12:00:00Z",
      fileName: "jun.pdf",
      fileUrl: "https://example.com/jun.pdf",
    };
    expect(getLatestTimesheetUpload([a, b, c])).toEqual(c);
  });
});

describe("formatTimesheetDate", () => {
  it("formats date and time correctly", () => {
    expect(formatTimesheetDate("2025-06-07T14:30:00Z")).toBe(
      "7 Jun 2025, 14:30",
    );
  });

  it("pads single-digit day, hour, minute", () => {
    expect(formatTimesheetDate("2025-01-05T09:05:00Z")).toBe(
      "5 Jan 2025, 09:05",
    );
  });

  it("works with a full ISO string", () => {
    expect(formatTimesheetDate("2024-12-25T08:15:30.000Z")).toBe(
      "25 Dec 2024, 08:15",
    );
  });
});
