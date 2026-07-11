import { getAuth } from "firebase-admin/auth";

export async function removeAuthUser(email: string): Promise<void> {
  const adminAuth = getAuth();
  try {
    const user = await adminAuth.getUserByEmail(email);
    await adminAuth.deleteUser(user.uid);
  } catch (err: unknown) {
    const authErr = err as { code?: string };
    if (authErr.code !== "auth/user-not-found") throw err;
  }
}
