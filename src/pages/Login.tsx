import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Button, Input, Label, SecondaryButton } from "../components/ui";
import { NonAuthForm } from "../components/NonAuthForm";
import { loginWithEmail } from "../services/authService";
import { useToast } from "../context/ToastProvider";
import { toast_mapper, ToastType } from "../config/toast";
import { LoadingPage } from "../components/LoadingPage";

export const Login = () => {
  const location = useLocation();
  const [email, setEmail] = useState(location.state.email);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const shownRef = useRef(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = "Login";
  }, []);

  useEffect(() => {
    if (shownRef.current) return;
    const state = location.state as { email?: string } | null;
    if (state?.email) {
      shownRef.current = true;
      toast(toast_mapper[ToastType.PASSWORD_RESET_SUCCESS]);
      passwordRef.current?.focus();
    }
  }, []);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!email || !password) {
      toast(toast_mapper[ToastType.MISSING_CREDENTIALS]);
      return;
    }
    if (!/.+@.+\..+/.test(email)) {
      toast(toast_mapper[ToastType.INVALID_EMAIL_FORMAT]);
      return;
    }

    setLoading(true);
    try {
      await loginWithEmail(email.trim(), password);
    } catch (err) {
      const code =
        err instanceof Error && "code" in err
          ? (err as { code: string }).code
          : "";

      if (code === "auth/invalid-credential") {
        toast(toast_mapper[ToastType.INVALID_CREDENTIALS]);
      } else if (code === "auth/too-many-requests") {
        toast(toast_mapper[ToastType.TOO_MANY_LOGIN_ATTEMPTS]);
      } else if (code === "auth/user-disabled") {
        toast(toast_mapper[ToastType.ACCOUNT_DISABLED]);
      } else {
        toast(toast_mapper[ToastType.LOGIN_FAILED]);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingPage />;

  return (
    <NonAuthForm
      title="Login"
      subtitle="Enter your details below to sign in"
      onSubmit={onSubmit}
      footer={
        <div className="flex justify-end">
          <a
            href="https://mds-ce.com"
            className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            Back to mds-ce.com
          </a>
        </div>
      }
      actionButtons={[
        <SecondaryButton
          key="forgot"
          type="button"
          onClick={() => {
            window.location.href = `/forgot-password?email=${encodeURIComponent(email)}`;
          }}
        >
          Forgot password?
        </SecondaryButton>,
        <Button
          key="login"
          type="submit"
          disabled={loading}
          className="h-auto py-2 text-sm"
        >
          Login
        </Button>,
      ]}
    >
      <div className="space-y-1">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@agency.com"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="password">Password</Label>
        <Input
          ref={passwordRef}
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="********"
        />
      </div>
    </NonAuthForm>
  );
};
