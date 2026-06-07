export interface TimesheetEntry {
  uploadedBy: string;
  uploadedAt: string;
  fileName: string;
  fileUrl: string;
}

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
