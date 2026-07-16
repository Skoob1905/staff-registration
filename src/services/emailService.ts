import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

export function extractResetTokenFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("token");
}

export async function callValidateToken(
  token: string,
): Promise<{ valid: boolean; reason?: string }> {
  const fn = httpsCallable<
    { token: string },
    { valid: boolean; reason?: string }
  >(functions, "validateResetToken");
  const result = await fn({ token });
  return result.data;
}

export async function callCompletePasswordReset(
  token: string,
  newPassword: string,
): Promise<{ email: string }> {
  const fn = httpsCallable<
    { token: string; newPassword: string },
    { success: boolean; email: string }
  >(functions, "completePasswordReset");
  const result = await fn({ token, newPassword });
  return { email: result.data.email };
}
