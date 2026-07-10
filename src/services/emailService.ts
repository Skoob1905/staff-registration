import { confirmPasswordReset } from "firebase/auth";
import { auth } from "./firebase";

export function extractOobCodeFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("oobCode");
}

export async function confirmPasswordResetCode(
  oobCode: string,
  newPassword: string,
): Promise<void> {
  await confirmPasswordReset(auth, oobCode, newPassword);
}
