import { useEffect, useState } from "react";
import { Mail, Key, Building, Shield } from "lucide-react";
import { Button } from "../components/ui";
import { Section } from "../components/Section";
import { useAuth } from "../context/AuthProvider";
import { useToast } from "../context/ToastProvider";
import { sendForgotPassword } from "../services/authService";
import { getCompanyName } from "../utils/company";
import { Caption } from "../config/typography";

export const ProfilePage = () => {
  useEffect(() => {
    document.title = "Profile";
  }, []);

  const { appUser, agency, firebaseUser } = useAuth();
  const { toast } = useToast();
  const [resetLoading, setResetLoading] = useState(false);

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
    <div className="mx-auto max-w-2xl space-y-4">
      <Section
        title="Profile"
        action={
          <Button
            type="button"
            disabled={resetLoading}
            onClick={() => void onResetPassword()}
            className="inline-flex items-center gap-1 text-xs sm:text-sm"
          >
            <Key className="h-3.5 w-3.5" />
            {resetLoading ? "Sending..." : "Reset Password"}
          </Button>
        }
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-[var(--muted-foreground)]" />
            <div>
              <Caption>Email</Caption>
              <p className="text-xs sm:text-sm font-medium">
                {appUser?.email || "—"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-[var(--muted-foreground)]" />
            <div>
              <Caption>Role</Caption>
              <p className="text-xs sm:text-sm font-medium capitalize">
                {appUser?.role || "—"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Building className="h-5 w-5 text-[var(--muted-foreground)]" />
            <div>
              <Caption>Company</Caption>
              <p className="text-xs sm:text-sm font-medium">
                {agency
                  ? getCompanyName(agency as unknown as Record<string, unknown>)
                  : "—"}
              </p>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
};
