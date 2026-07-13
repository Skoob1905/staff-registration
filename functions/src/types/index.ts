export interface LoginDoc {
  email: string;
  role: "worker" | "admin" | "client";
  importId: string;
  pending: boolean;
  loginSentAt?: FirebaseFirestore.Timestamp;
  requestedAt: FirebaseFirestore.Timestamp;
  requestedBy: string;
  loginStatus?: "awaiting_login" | "password_set" | "logged_in";
}
