export interface TimesheetEntry {
  uploadedBy: string;
  uploadedAt: string;
  fileName: string;
  fileUrl: string;
  hasSeen?: boolean;
  hasDownloaded?: boolean;
}

export interface AgencyTimesheets {
  agencyId: string;
  agencyName: string;
  timesheets: TimesheetEntry[];
}

export const getAllTimesheets = async (): Promise<AgencyTimesheets[]> => {
  const { collection, getDocs } = await import("firebase/firestore");
  const { db } = await import("../services/firebase");
  const snaps = await getDocs(collection(db, "agencies"));
  const results: AgencyTimesheets[] = [];

  for (const snap of snaps.docs) {
    const data = snap.data() as Record<string, unknown>;
    const timesheets = ((data.metadata as Record<string, unknown>)?.timesheets ?? []) as TimesheetEntry[];
    if (timesheets.length > 0) {
      const name: string =
        (data.name as string) ||
        (data.business_name as string) ||
        (data.Company_Name as string) ||
        (data.company_name as string) ||
        (data.agencyName as string) ||
        "Unknown Agency";
      results.push({
        agencyId: snap.id,
        agencyName: name,
        timesheets: timesheets.sort(
          (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
        ),
      });
    }
  }

  return results.sort((a, b) => a.agencyName.localeCompare(b.agencyName));
};

export const getTimesheetsForAgency = async (
  agencyId: string,
): Promise<TimesheetEntry[]> => {
  const { doc, getDoc } = await import("firebase/firestore");
  const { db } = await import("../services/firebase");
  const snap = await getDoc(doc(db, "agencies", agencyId));
  if (!snap.exists()) return [];
  const data = snap.data() as Record<string, unknown>;
  const timesheets = ((data.metadata as Record<string, unknown>)?.timesheets ?? []) as TimesheetEntry[];
  return timesheets.sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
  );
};

const MONTHS = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];

export const formatTimesheetDate = (uploadedAt: string): string => {
  const d = new Date(uploadedAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};

export const getLatestTimesheetUpload = (
  entries: TimesheetEntry[],
): TimesheetEntry | null => {
  if (entries.length === 0) return null;
  return entries.reduce((latest, entry) =>
    entry.uploadedAt > latest.uploadedAt ? entry : latest,
  );
};
