export const toDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "_seconds" in value
  ) {
    return new Date((value as { _seconds: number })._seconds * 1000);
  }
  const d = new Date(value as string);
  return isNaN(d.getTime()) ? null : d;
};

export const formatInvitedAt = (value: unknown): string => {
  const parsedDate = toDate(value);
  if (!parsedDate) return "N/A";

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(parsedDate.getDate())}-${pad(parsedDate.getMonth() + 1)}-${parsedDate.getFullYear()} ${pad(parsedDate.getHours())}:${pad(parsedDate.getMinutes())}:${pad(parsedDate.getSeconds())}`;
};

export const formatSentDate = (value: unknown): string => {
  const parsedDate = toDate(value);
  if (!parsedDate) return "";

  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${parsedDate.getDate()} ${months[parsedDate.getMonth()]} ${parsedDate.getFullYear()}`;
};
