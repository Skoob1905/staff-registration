import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "./firebase";
import { config } from "../config";

export const initAuthPersistence = async (): Promise<void> => {
  await setPersistence(auth, browserLocalPersistence);
};

export const loginWithEmail = async (email: string, password: string): Promise<void> => {
  await signInWithEmailAndPassword(auth, email, password);
};

export const logoutUser = async (): Promise<void> => {
  await signOut(auth);
};

export const sendForgotPassword = async (email: string): Promise<void> => {
  const fn = httpsCallable(functions, "sendPasswordReset");
  await fn({
    email,
    continueUrl: window.location.origin + "/reset-password",
    companyName: config.name,
  });
};

export const updateLoginStatus = async (
  email: string,
  status: "awaiting_login" | "password_set" | "logged_in",
): Promise<void> => {
  const fn = httpsCallable(functions, "updateLoginStatus");
  await fn({ email, status });
};

export const onAuthUserChanged = (callback: (user: User | null) => void): (() => void) => {
  return onAuthStateChanged(auth, callback);
};
