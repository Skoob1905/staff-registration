import type { FirebaseError } from "firebase/app";

export enum ToastType {
  PASSWORD_RESET_SUCCESS = "PASSWORD_RESET_SUCCESS",
  INVALID_TOKEN = "INVALID_TOKEN",
  TOKEN_ALREADY_USED = "TOKEN_ALREADY_USED",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  INVALID_PASSWORD = "INVALID_PASSWORD",
  INVALID_CONFIRM_PASSWORD = "INVALID_CONFIRM_PASSWORD",
  PASSWORDS_DO_NOT_MATCH = "PASSWORDS_DO_NOT_MATCH",
  INVALID_RESET_TOKEN = "INVALID_RESET_TOKEN",
  MISSING_CREDENTIALS = "MISSING_CREDENTIALS",
  INVALID_EMAIL_FORMAT = "INVALID_EMAIL_FORMAT",
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  TOO_MANY_LOGIN_ATTEMPTS = "TOO_MANY_LOGIN_ATTEMPTS",
  ACCOUNT_DISABLED = "ACCOUNT_DISABLED",
  LOGIN_FAILED = "LOGIN_FAILED",
}

interface ToastConfig {
  title: string;
  description?: string;
  variant: "success" | "error" | "warning" | "info";
}

export const toast_mapper: Record<ToastType, ToastConfig> = {
  [ToastType.PASSWORD_RESET_SUCCESS]: {
    title: "Password set successfully",
    variant: "success",
  },
  [ToastType.INVALID_TOKEN]: {
    title: "Invalid reset link",
    description:
      "The reset link you used is invalid. Please request a new one.",
    variant: "error",
  },
  [ToastType.TOKEN_ALREADY_USED]: {
    title: "Link already used",
    description:
      "This reset link has already been used. Please request a new one.",
    variant: "error",
  },
  [ToastType.TOKEN_EXPIRED]: {
    title: "Link expired",
    description: "This reset link has expired. Please request a new one.",
    variant: "warning",
  },
  [ToastType.INVALID_PASSWORD]: {
    title: "Invalid password",
    description: "Password must be at least 6 characters.",
    variant: "error",
  },
  [ToastType.INVALID_CONFIRM_PASSWORD]: {
    title: "Missing fields",
    description: "Please enter and confirm your new password.",
    variant: "error",
  },
  [ToastType.PASSWORDS_DO_NOT_MATCH]: {
    title: "Passwords do not match",
    description: "The new password and confirmation do not match.",
    variant: "error",
  },
  [ToastType.INVALID_RESET_TOKEN]: {
    title: "Invalid reset link",
    description: "This reset link is invalid, already used, or has expired. Please request a new one.",
    variant: "error",
  },
  [ToastType.MISSING_CREDENTIALS]: {
    title: "Please enter both email and password.",
    variant: "error",
  },
  [ToastType.INVALID_EMAIL_FORMAT]: {
    title: "Enter a valid email address.",
    variant: "error",
  },
  [ToastType.INVALID_CREDENTIALS]: {
    title: "Login failed",
    description: "Invalid email or password. Please check your username and password and try again.",
    variant: "error",
  },
  [ToastType.TOO_MANY_LOGIN_ATTEMPTS]: {
    title: "Login failed",
    description: "Too many login attempts. Please wait a moment and try again.",
    variant: "error",
  },
  [ToastType.ACCOUNT_DISABLED]: {
    title: "Login failed",
    description: "This account has been disabled. Please contact your administrator.",
    variant: "error",
  },
  [ToastType.LOGIN_FAILED]: {
    title: "Login failed",
    description: "Check your credentials and try again.",
    variant: "error",
  },
};

export function parseResetError(error: FirebaseError): ToastType | null {
  const match = Object.values(ToastType).find((code) =>
    error.message.startsWith(code),
  );
  return match ?? null;
}
