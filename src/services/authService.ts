import {
  browserLocalPersistence,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "./firebase";

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
  await sendPasswordResetEmail(auth, email);
};

export const onAuthUserChanged = (callback: (user: User | null) => void): (() => void) => {
  return onAuthStateChanged(auth, callback);
};
