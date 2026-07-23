export function getEmailRate(emailsPerHour: number): number {
  if (emailsPerHour <= 0) return 1000;
  return Math.round((1000 * 60 * 60) / emailsPerHour);
}
