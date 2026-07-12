import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Input, Label } from "../components/ui";
import { NonAuthForm } from "../components/NonAuthForm";
import {
  extractOobCodeFromUrl,
  confirmPasswordResetCode,
} from "../services/emailService";
import { updateLoginStatus } from "../services/authService";

export const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const oobCode = extractOobCodeFromUrl();

  const navToLogin = (resetPassword: "success" | "failure") => {
    navigate("/login", { state: { resetPassword } });
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!password || !confirmPassword) {
      navToLogin("failure");
      return;
    }

    if (password.length < 6) {
      navToLogin("failure");
      return;
    }

    if (password !== confirmPassword) {
      navToLogin("failure");
      return;
    }

    setLoading(true);
    try {
      const { email } = await confirmPasswordResetCode(oobCode!, password);
      updateLoginStatus(email, "password_set").catch(() => {});
      navToLogin("success");
    } catch {
      navToLogin("failure");
    } finally {
      setLoading(false);
    }
  };

  if (!oobCode) {
    return (
      <NonAuthForm title="Reset Password" subtitle="Choose a new password for your account">
        <p className="text-sm text-center text-zinc-500">
          Invalid or expired reset link.
        </p>
      </NonAuthForm>
    );
  }

  return (
    <NonAuthForm
      title="Reset Password"
      subtitle="Choose a new password for your account"
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
