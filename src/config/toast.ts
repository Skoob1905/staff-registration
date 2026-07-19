import type { FirebaseError } from "firebase/app";

export const ToastType = {
  /**
   * LOGIN/EMAIL/AUTHENTICATION
   */
  DEFAULT_ERROR: "DEFAULT_ERROR",
  PASSWORD_RESET_SUCCESS: "PASSWORD_RESET_SUCCESS",
  INVALID_TOKEN: "INVALID_TOKEN",
  TOKEN_ALREADY_USED: "TOKEN_ALREADY_USED",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  INVALID_PASSWORD: "INVALID_PASSWORD",
  INVALID_CONFIRM_PASSWORD: "INVALID_CONFIRM_PASSWORD",
  PASSWORDS_DO_NOT_MATCH: "PASSWORDS_DO_NOT_MATCH",
  INVALID_RESET_TOKEN: "INVALID_RESET_TOKEN",
  MISSING_CREDENTIALS: "MISSING_CREDENTIALS",
  INVALID_EMAIL_FORMAT: "INVALID_EMAIL_FORMAT",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  TOO_MANY_LOGIN_ATTEMPTS: "TOO_MANY_LOGIN_ATTEMPTS",
  ACCOUNT_DISABLED: "ACCOUNT_DISABLED",
  LOGIN_FAILED: "LOGIN_FAILED",
  RESET_FAILED: "RESET_FAILED",
  RESET_PASSWORD_LINK_SET: "RESET_PASSWORD_LINK_SENT",
  /**
   * FILE UPLOADING
   */
  SUCCESSFUL_FILE_UPLOAD: "SUCCESSFUL_FILE_UPLOAD",
  INVALID_FILE: "INVALID_FILE",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  EMPTY_CSV: "EMPTY_CSV",
  EMPTY_CSV_DATA: "EMPTY_CSV_DATA",
  NO_REFERENCE_COLUMN: "NO_REFERENCE_COLUMN",
  INVALID_AGENCY_FILE: "INVALID_AGENCY_FILE",
  INVALID_CLIENT_FILE: "INVALID_CLIENT_FILE",
  TIMESHEET_UPLOADED: "TIMESHEET_UPLOADED",
  TOO_MANY_RECORDS: "TOO_MANY_RECORDS",
  IMPORT_ALL_DUPLICATES: "IMPORT_ALL_DUPLICATES",
  IMPORT_SUCCESS: "IMPORT_SUCCESS",
  EMAIL_FAILURE: "EMAIL_FAILURE",
  EMAILS_SENT: "EMAILS_SENT",
  DUPLICATE_TIMESHEET: "DUPLICATE_TIMESHEET",
  UPLOAD_FAILED: "UPLOAD_FAILED",
} as const;

export type ToastType = (typeof ToastType)[keyof typeof ToastType];

interface StaticToastConfig {
  title: string;
  description?: string;
  variant: "success" | "error" | "warning" | "info";
  replaceToast?: boolean;
}

type DynamicToastConfig = (...args: any[]) => StaticToastConfig;

export const toast_mapper = {
  [ToastType.DEFAULT_ERROR]: {
    title: "Something Went Wrong",
    description: "Please try again soon.",
    variant: "error",
  },
  [ToastType.PASSWORD_RESET_SUCCESS]: {
    title: "Password Set Successfully",
    description: "Please enter your new password below",
    variant: "success",
  },
  [ToastType.INVALID_TOKEN]: {
    title: "Invalid Reset Link",
    description:
      "The reset link you used is invalid. Please request a new one.",
    variant: "error",
  },
  [ToastType.TOKEN_ALREADY_USED]: {
    title: "Link Already Used",
    description:
      "This reset link has already been used. Please request a new one.",
    variant: "error",
  },
  [ToastType.TOKEN_EXPIRED]: {
    title: "Link Expired",
    description: "This reset link has expired. Please request a new one.",
    variant: "warning",
  },
  [ToastType.INVALID_PASSWORD]: {
    title: "Invalid Password",
    description: "Password must be at least 6 characters.",
    variant: "error",
  },
  [ToastType.INVALID_CONFIRM_PASSWORD]: {
    title: "Missing Fields",
    description: "Please enter and confirm your new password.",
    variant: "error",
  },
  [ToastType.PASSWORDS_DO_NOT_MATCH]: {
    title: "Passwords Do Not Match",
    description: "The new password and confirmation do not match.",
    variant: "error",
  },
  [ToastType.INVALID_RESET_TOKEN]: {
    title: "Invalid Reset Link",
    description:
      "This reset link is invalid, already used, or has expired. Please request a new one.",
    variant: "error",
  },
  [ToastType.MISSING_CREDENTIALS]: {
    title: "Please Enter Both Email And Password",
    variant: "error",
  },
  [ToastType.INVALID_EMAIL_FORMAT]: {
    title: "Enter A Valid Email Address",
    variant: "error",
  },
  [ToastType.INVALID_CREDENTIALS]: {
    title: "Login Failed",
    description:
      "Invalid email or password. Please check your username and password and try again.",
    variant: "error",
  },
  [ToastType.TOO_MANY_LOGIN_ATTEMPTS]: {
    title: "Login Failed",
    description: "Too many login attempts. Please wait a moment and try again.",
    variant: "error",
  },
  [ToastType.ACCOUNT_DISABLED]: {
    title: "Login Failed",
    description:
      "This account has been disabled. Please contact your administrator.",
    variant: "error",
  },
  [ToastType.LOGIN_FAILED]: {
    title: "Login Failed",
    description: "Check your credentials and try again.",
    variant: "error",
  },
  [ToastType.RESET_FAILED]: {
    title: "Reset Failed",
    description: "Something went wrong. Please request a new reset link.",
    variant: "error",
  },
  [ToastType.RESET_PASSWORD_LINK_SET]: {
    title: "Reset Email Sent",
    description:
      "If an account with that email exists, instructions have been sent.",
    variant: "info",
  },
  [ToastType.SUCCESSFUL_FILE_UPLOAD]: (addedRecords: number) => ({
    title: "Successful File Upload",
    description: `${addedRecords} added`,
    variant: "info",
  }),

  // --- AddModal toasts ---

  [ToastType.INVALID_FILE]: {
    title: "Invalid File",
    description: "Please upload a CSV file.",
    variant: "error",
  },
  [ToastType.FILE_TOO_LARGE]: {
    title: "File Too Large",
    description: "In preview mode, files are limited to 100KB.",
    variant: "error",
  },
  [ToastType.EMPTY_CSV]: {
    title: "Empty CSV",
    description: "The CSV file has no headers.",
    variant: "error",
  },
  [ToastType.EMPTY_CSV_DATA]: {
    title: "Empty CSV",
    description:
      "The CSV has headers but no data rows. Add data and try again.",
    variant: "error",
  },
  [ToastType.NO_REFERENCE_COLUMN]: {
    title: "No Reference Column",
    description:
      "CSV missing Ref/Reference/Workers Ref column. Staff IDs will be auto-generated.",
    variant: "error",
  },
  [ToastType.INVALID_AGENCY_FILE]: {
    title: "Invalid Agency File",
    description: "The CSV must contain a Ref or Reference column.",
    variant: "error",
  },
  [ToastType.INVALID_CLIENT_FILE]: {
    title: "Invalid Client File",
    description: "The CSV must contain a Ref or Reference column.",
    variant: "error",
  },
  [ToastType.TIMESHEET_UPLOADED]: {
    title: "Timesheet Uploaded",
    description:
      "We have received your timesheet and will process it as soon as possible.",
    variant: "success",
  },
  [ToastType.TOO_MANY_RECORDS]: (
    existingCount: number,
    uploadCount: number,
    maxRecords: number,
    label: string,
  ) => ({
    title: "Too Many Records",
    description: `You have ${existingCount} ${label} in the database. Uploading ${uploadCount} more would exceed the ${maxRecords} limit. Please delete some ${label} first.`,
    variant: "error",
  }),
  [ToastType.IMPORT_ALL_DUPLICATES]: (
    duplicates: number,
  ) => ({
    title: "No Records Added",
    description: `All ${duplicates} staff already exist.`,
    variant: "info",
    replaceToast: true,
  }),
  [ToastType.IMPORT_SUCCESS]: (
    added: number,
    itemLabel: string,
    itemLabelPlural: string,
    duplicates: number,
  ) => {
    const dupInfo =
      duplicates > 0
        ? ` (${duplicates} duplicate${duplicates === 1 ? "" : "s"} skipped)`
        : "";
    return {
      title: "Import Complete",
      description: `${added} ${added === 1 ? itemLabel : itemLabelPlural} added${dupInfo}. Logins will be sent shortly.`,
      variant: "success",
      replaceToast: true,
    };
  },
  [ToastType.EMAIL_FAILURE]: (sent: number, failed: number) => ({
    title: `${failed} Email(s) Failed`,
    description: `${sent} sent, ${failed} failed.`,
    variant: "error",
  }),
  [ToastType.EMAILS_SENT]: (sent: number) => ({
    title: "Emails Sent",
    description: `${sent} login email(s) delivered.`,
    variant: "success",
  }),
  [ToastType.DUPLICATE_TIMESHEET]: (fileName: string) => ({
    title: "Duplicate Timesheet",
    description: `A timesheet named "${fileName}" has already been uploaded.`,
    variant: "error",
  }),
  [ToastType.UPLOAD_FAILED]: (message: string) => ({
    title: "Upload Failed",
    description: message,
    variant: "error",
    replaceToast: true,
  }),
} satisfies Record<ToastType, StaticToastConfig | DynamicToastConfig>;

export function parseResetError(error: FirebaseError): ToastType | null {
  const match = (Object.values(ToastType) as string[]).find((code) =>
    error.message.startsWith(code),
  );
  return (match as ToastType) ?? null;
}
