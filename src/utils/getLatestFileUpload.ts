export interface FileEntry {
  uploadedAt: string;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export const formatDate = (uploadedAt: string): string => {
  const d = new Date(uploadedAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};

export const getLatestFileUpload = (entries: FileEntry[]): FileEntry | null => {
  if (entries.length === 0) return null;
  return entries.reduce((latest, entry) =>
    entry.uploadedAt > latest.uploadedAt ? entry : latest,
  );
};
