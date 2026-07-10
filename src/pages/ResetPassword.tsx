import { useEffect, useState } from "react";
import { Alert, Button, Card, Input, Label } from "../components/ui";
import { useToast } from "../context/ToastProvider";
import { config } from "../config";
import {
  extractOobCodeFromUrl,
  confirmPasswordResetCode,
  redirectToLogin,
} from "../services/emailService";

export const ResetPassword = () => {
  useEffect(() => {
    document.title = "Reset Password";
  }, []);

  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const oobCode = extractOobCodeFromUrl();

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (!password || !confirmPassword) {
      setError("Please enter both password fields.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await confirmPasswordResetCode(oobCode!, password);
      toast({ title: "Password set successfully", variant: "success" });
      redirectToLogin();
    } catch {
      setError("Failed to reset password. The link may have expired.");
    } finally {
      setLoading(false);
    }
  };

  if (!oobCode) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 app-bg">
        <Card className="w-full max-w-md p-6 text-center">
          <p className="text-sm text-zinc-500">
            Invalid or expired reset link.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 app-bg">
      <Card className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-8">
          <img
            src={config.login}
            alt={config.name}
            className="h-auto max-h-[20vh] w-auto object-contain"
          />
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
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

          {error ? <Alert>{error}</Alert> : null}

          <Button
            type="submit"
            disabled={loading}
            className="h-auto w-full py-2 text-sm"
          >
            {loading ? "Resetting..." : "Set Password"}
          </Button>
        </form>
      </Card>
    </div>
  );
};
