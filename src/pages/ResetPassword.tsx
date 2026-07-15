import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import type { FirebaseError } from "firebase/app";
import { Button, Input, Label } from "../components/ui";
import { NonAuthForm } from "../components/NonAuthForm";
import {
  extractResetTokenFromUrl,
  callValidateToken,
  callCompletePasswordReset,
} from "../services/emailService";
import { updateLoginStatus } from "../services/authService";
import { useToast } from "../context/ToastProvider";
import { toast_mapper, ToastType, parseResetError } from "../config/toast";

export const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  const token = extractResetTokenFromUrl();

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }

    callValidateToken(token)
      .then((result) => {
        if (!result.valid) {
          toast(toast_mapper[ToastType.INVALID_RESET_TOKEN]);
          navigate("/login");
        } else {
          setReady(true);
        }
      })
      .catch(() => {
        navigate("/login");
      });
  }, []);

  if (!token || !ready) {
    return null;
  }

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!password || !confirmPassword) {
      toast(toast_mapper[ToastType.INVALID_CONFIRM_PASSWORD]);
      return;
    }

    if (password.length < 6) {
      toast(toast_mapper[ToastType.INVALID_PASSWORD]);
      return;
    }

    if (password !== confirmPassword) {
      toast(toast_mapper[ToastType.PASSWORDS_DO_NOT_MATCH]);
      return;
    }

    setLoading(true);
    try {
      const { email } = await callCompletePasswordReset(token, password);
      updateLoginStatus(email, "password_set").catch(() => {});
      navigate("/login", { state: { email } });
    } catch (error) {
      const code = parseResetError(error as FirebaseError);
      if (code) {
        toast(toast_mapper[code]);
      }
      navigate("/login");
    } finally {
      setLoading(false);
    }
  };

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
