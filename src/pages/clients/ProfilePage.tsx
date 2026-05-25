import { useEffect, useState } from "react";
import { Mail, Key, Building, Shield } from "lucide-react";
import { Card, Button } from "../../components/ui";
import { useAuth } from "../../context/AuthProvider";
import { useToast } from "../../context/ToastProvider";
import { sendForgotPassword } from "../../services/authService";
import { getCompanyName } from "../../utils/company";

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
      <Card>
        <h2 className="text-base font-bold">Profile</h2>
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-[var(--muted-foreground)]" />
            <div>
              <p className="text-xs text-[var(--muted-foreground)]">Email</p>
              <p className="text-xs sm:text-sm font-medium">
                {appUser?.email || "—"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-[var(--muted-foreground)]" />
            <div>
              <p className="text-xs text-[var(--muted-foreground)]">Role</p>
              <p className="text-xs sm:text-sm font-medium capitalize">
                {appUser?.role || "—"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Building className="h-4 w-4 text-[var(--muted-foreground)]" />
            <div>
              <p className="text-xs text-[var(--muted-foreground)]">Company</p>
              <p className="text-xs sm:text-sm font-medium">
                {agency
                  ? getCompanyName(agency as unknown as Record<string, unknown>)
                  : "—"}
              </p>
            </div>
          </div>
        </div>

        <hr className="my-3 border-[var(--border)]" />

        <div>
          <Button
            type="button"
            disabled={resetLoading}
            onClick={() => void onResetPassword()}
            className="inline-flex items-center gap-1 text-xs sm:text-sm"
          >
            <Key className="h-3.5 w-3.5" />
            {resetLoading ? "Sending..." : "Reset Password"}
          </Button>
        </div>
      </Card>
    </div>
  );
};
