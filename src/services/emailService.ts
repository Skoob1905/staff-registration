import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { auth } from "./firebase";

export function extractOobCodeFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("oobCode");
}

export async function confirmPasswordResetCode(
  oobCode: string,
  newPassword: string,
): Promise<{ email: string }> {
  const email = await verifyPasswordResetCode(auth, oobCode);
  await confirmPasswordReset(auth, oobCode, newPassword);
  return { email };
}
