import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
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
  const shownRef = useRef(false);

  const token = extractResetTokenFromUrl();

  useEffect(() => {
    if (shownRef.current) return;
    shownRef.current = true;

    if (!token) {
      console.log("[ResetPassword] no token in URL, redirecting to /login");
      navigate("/login");
      return;
    }

    console.log(
      "[ResetPassword] extracted token (first 8 chars):",
      `${token.substring(0, 8)}...`,
    );

    callValidateToken(token)
      .then((result) => {
        console.log("[ResetPassword] validate result:", result);
        if (!result.valid) {
          navigate("/login", { state: "reset-password" });
          toast(toast_mapper[ToastType.INVALID_RESET_TOKEN]);
        } else {
          setReady(true);
        }
      })
      .catch((err) => {
        console.error("[ResetPassword] validate threw an error:", err);
        navigate("/login");
        toast(toast_mapper[ToastType.INVALID_RESET_TOKEN]);
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
      updateLoginStatus(email, "password_set");
      navigate("/login", { state: { email, source: "reset-password" } });
    } catch (error) {
      const code = parseResetError(error as FirebaseError);
      if (code) {
        toast(
          toast_mapper[code as keyof typeof toast_mapper] as Parameters<
            typeof toast
          >[0],
        );
      } else {
        toast(toast_mapper[ToastType.RESET_FAILED]);
      }
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
