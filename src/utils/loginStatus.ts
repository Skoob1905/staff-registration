export function shouldShowSendLink(loginStatus?: string): boolean {
  return !loginStatus || loginStatus === "failed";
}
