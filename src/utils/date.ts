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
  return null;
};

export const formatInvitedAt = (value: unknown): string => {
  const parsedDate = toDate(value);
  if (!parsedDate) return "N/A";

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(parsedDate.getDate())}-${pad(parsedDate.getMonth() + 1)}-${parsedDate.getFullYear()} ${pad(parsedDate.getHours())}:${pad(parsedDate.getMinutes())}:${pad(parsedDate.getSeconds())}`;
};
