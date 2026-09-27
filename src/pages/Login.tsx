import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Key, Mail } from "lucide-react";
import { NonAuthForm } from "../components/NonAuthForm";
import { loginWithEmail } from "../services/authService";
import { useToast } from "../context/ToastProvider";
import { toast_mapper, ToastType } from "../config/toast";
import { LoadingPage } from "../components/LoadingPage";

export const Login = () => {
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email ?? "");
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
    shownRef.current = true;
    const state = location.state as { email?: string; source?: string } | null;
    if (state) {
      switch (state.source) {
        case "forgot-password":
          toast(toast_mapper[ToastType.RESET_PASSWORD_LINK_SET]);
          break;
        case "reset-password": {
          toast(toast_mapper[ToastType.PASSWORD_RESET_SUCCESS]);
          passwordRef.current?.focus();
        }
      }
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
      title="Enter your details below to log in"
      submitTitle="Login"
      onSubmit={onSubmit}
      loading={loading}
      forgotPasswordHref={`/forgot-password?email=${encodeURIComponent(email)}`}
      inputs={[
        {
          id: "email",
          value: email,
          onChange: setEmail,
          placeholder: "you@agency.com",
          icon: <Mail className="h-4 w-4" />,
        },
        {
          id: "password",
          value: password,
          onChange: setPassword,
          type: "password",
          placeholder: "********",
          inputRef: passwordRef,
          icon: <Key className="h-4 w-4" />,
        },
      ]}
    />
  );
};
