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
  const { getAllAgencies } = await import("../services/firestore");
  const snaps = await getAllAgencies();
  const results: AgencyTimesheets[] = [];

  for (const data of snaps as Record<string, unknown>[]) {
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
        agencyId: data.id as string,
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
  const { getAgency } = await import("../services/firestore");
  const data = await getAgency(agencyId);
  if (!data) return [];
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
