import { useState } from "react";
import { Button, Input, Label } from "../components/ui";
import { NonAuthForm } from "../components/NonAuthForm";
import { useToast } from "../context/ToastProvider";
import {
  extractOobCodeFromUrl,
  confirmPasswordResetCode,
  redirectToLogin,
} from "../services/emailService";

export const ResetPassword = () => {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const oobCode = extractOobCodeFromUrl();

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!password || !confirmPassword) {
      toast({ title: "Please enter both password fields.", variant: "error" });
      return;
    }

    if (password.length < 6) {
      toast({ title: "Password must be at least 6 characters.", variant: "error" });
      return;
    }

    if (password !== confirmPassword) {
      toast({ title: "Passwords do not match.", variant: "error" });
      return;
    }

    setLoading(true);
    try {
      await confirmPasswordResetCode(oobCode!, password);
      toast({ title: "Password set successfully", variant: "success" });
      redirectToLogin();
    } catch {
      toast({
        title: "Failed to reset password. The link may have expired.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!oobCode) {
    return (
      <NonAuthForm title="Reset Password">
        <p className="text-sm text-center text-zinc-500">
          Invalid or expired reset link.
        </p>
      </NonAuthForm>
    );
  }

  return (
    <NonAuthForm
      title="Reset Password"
      onSubmit={onSubmit}
      actionButtons={[
        <Button
          key="submit"
          type="submit"
          disabled={loading}
          className="h-auto py-2 text-sm"
        >
          {loading ? "Resetting..." : "Set Password"}
        </Button>,
      ]}
    >
      <div className="space-y-1">
        <Label htmlFor="password">New Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Min. 6 characters"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="confirm-password">Confirm Password</Label>
        <Input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Re-enter password"
        />
      </div>
    </NonAuthForm>
  );
};
