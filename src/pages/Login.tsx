import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Input, Label, SecondaryButton } from "../components/ui";
import { NonAuthForm } from "../components/NonAuthForm";
import { loginWithEmail } from "../services/authService";
import { useToast } from "../context/ToastProvider";
import { LoadingPage } from "../components/LoadingPage";

export const Login = () => {
  const [searchParams] = useSearchParams();
  const initialEmail = searchParams.get("email") ?? "";
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    document.title = "Login";
  }, []);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!email || !password) {
      toast({ title: "Please enter both email and password.", variant: "error" });
      return;
    }
    if (!/.+@.+\..+/.test(email)) {
      toast({ title: "Enter a valid email address.", variant: "error" });
      return;
    }

    setLoading(true);
    try {
      await loginWithEmail(email.trim(), password);
    } catch {
      toast({ title: "Login failed. Check your credentials and try again.", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingPage />;

  return (
    <NonAuthForm
      title="Login"
      onSubmit={onSubmit}
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
