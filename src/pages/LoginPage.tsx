import { useState } from "react";
import { Alert, Button, Card, Input, Label, Separator, SecondaryButton } from "../components/ui";
import { loginWithEmail, sendForgotPassword } from "../services/authService";

export const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }
    if (!/.+@.+\..+/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      await loginWithEmail(email.trim(), password);
    } catch {
      setError("Login failed. Check your credentials and try again.");
    } finally {
      setLoading(false);
    }
  };

  const onForgot = async () => {
    setError("");
    if (!email) {
      setError("Enter your email first to reset your password.");
      return;
    }
    await sendForgotPassword(email.trim());
    setNotice("If that account exists, reset instructions were sent.");
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <h1 className="text-xl font-bold">Sign In</h1>
        <p className="mt-1 text-sm text-zinc-600">Access your agency workspace.</p>
        <Separator />

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@agency.com" />
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

          {error ? <Alert>{error}</Alert> : null}
          {notice ? <div className="rounded-xl border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm text-zinc-800">{notice}</div> : null}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Signing in..." : "Login"}
          </Button>

          <SecondaryButton type="button" onClick={() => void onForgot()} className="w-full">
            Forgot password?
          </SecondaryButton>
        </form>
      </Card>
    </div>
  );
};
