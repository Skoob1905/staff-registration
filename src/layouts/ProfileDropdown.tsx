import { useEffect, useRef, useState } from "react";
import { Building, Key, Mail, Shield, UserCircle } from "lucide-react";
import { Button } from "../components/ui";
import { useAuth } from "../context/AuthProvider";
import { useToast } from "../context/ToastProvider";
import { sendForgotPassword } from "../services/authService";
import { getAgencyName } from "../utils/agency";
import { Caption } from "../config/typography";

export const ProfileDropdown = () => {
  const { appUser, agency, firebaseUser } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const initials =
    appUser?.firstName && appUser?.lastName
      ? `${appUser.firstName[0]}${appUser.lastName[0]}`.toUpperCase()
      : null;

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const onResetPassword = async () => {
    if (!firebaseUser?.email) return;
    setResetLoading(true);
    try {
      await sendForgotPassword(firebaseUser.email);
      toast({
        title: "Email sent",
        description: "Check your inbox for the password reset link.",
      });
    } catch {
      toast({
        title: "Failed",
        description: "Could not send reset email. Try again later.",
        variant: "error",
      });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
      >
        {initials ? (
          <span className="flex size-8 items-center justify-center rounded-full bg-[var(--primary-100)] text-xs font-bold text-[var(--primary)]">
            {initials}
          </span>
        ) : (
          <UserCircle className="size-8" />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-lg animate-cascade"
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
              <div className="min-w-0">
                <Caption>Email</Caption>
                <p className="truncate text-xs font-medium">
                  {appUser?.email || "—"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
              <div>
                <Caption>Role</Caption>
                <p className="text-xs font-medium capitalize">
                  {appUser?.role || "—"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
              <div className="min-w-0">
                <Caption>Company</Caption>
                <p className="truncate text-xs font-medium">
                  {agency
                    ? getAgencyName(agency as unknown as Record<string, unknown>)
                    : "—"}
                </p>
              </div>
            </div>
          </div>

          <Button
            type="button"
            disabled={resetLoading}
            onClick={() => void onResetPassword()}
            className="mt-4 inline-flex w-full items-center justify-center gap-1 rounded-lg text-xs"
          >
            <Key className="h-3.5 w-3.5" />
            {resetLoading ? "Sending..." : "Reset Password"}
          </Button>
        </div>
      )}
    </div>
  );
};
