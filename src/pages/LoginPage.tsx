import { useEffect, useState } from "react";
import { z } from "zod";
import { Alert, Button, Card, Input, Label, Separator, SecondaryButton } from "../components/ui";
import { DialogRoot, DialogContent, DialogTitle } from "../components/ui/dialog";
import { loginWithEmail, sendForgotPassword } from "../services/authService";
import { useToast } from "../context/ToastProvider";

const emailSchema = z.string().email("Enter a valid email address.");

export const LoginPage = () => {
  useEffect(() => { document.title = "Login"; }, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

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

  const openForgotModal = () => {
    setError("");
    setForgotEmail(email);
    setShowForgotModal(true);
  };

  const closeForgotModal = () => {
    setShowForgotModal(false);
    setEmail(forgotEmail);
  };

  const onConfirmForgot = async () => {
    const result = emailSchema.safeParse(forgotEmail.trim());
    if (!result.success) {
      toast({ title: result.error.issues[0].message, variant: "error" });
      return;
    }

    setSending(true);
    try {
      await sendForgotPassword(result.data);
    } catch {
      // Silently ignore – we always show success for security
    } finally {
      setSending(false);
    }
    setShowForgotModal(false);
    setEmail(result.data);
    toast({
      title: "Reset email sent",
      description: "If an account with that email exists, instructions have been sent.",
      variant: "default",
    });
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

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Signing in..." : "Login"}
          </Button>

          <SecondaryButton type="button" onClick={openForgotModal} className="w-full">
            Forgot password?
          </SecondaryButton>
        </form>
      </Card>

      <DialogRoot open={showForgotModal} onOpenChange={(open) => { if (!open) closeForgotModal(); }}>
        <DialogContent onClose={closeForgotModal}>
          <DialogTitle className="text-lg font-bold">Reset Password</DialogTitle>
          <div className="mt-4 space-y-3">
            <Label htmlFor="forgot-email">Email</Label>
            <Input
              id="forgot-email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              placeholder="you@agency.com"
            />
            <div className="flex justify-end gap-2">
              <SecondaryButton type="button" onClick={closeForgotModal}>
                Cancel
              </SecondaryButton>
              <Button
                type="button"
                disabled={sending}
                onClick={() => void onConfirmForgot()}
              >
                {sending ? "Sending..." : "Confirm"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </DialogRoot>
    </div>
  );
};
