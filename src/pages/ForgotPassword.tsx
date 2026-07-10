import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { z } from "zod";
import { Button, Input, Label, SecondaryButton } from "../components/ui";
import { NonAuthForm } from "../components/NonAuthForm";
import { sendForgotPassword } from "../services/authService";
import { useToast } from "../context/ToastProvider";

const emailSchema = z.string().email("Enter a valid email address.");

export const ForgotPassword = () => {
  const [searchParams] = useSearchParams();
  const initialEmail = searchParams.get("email") ?? "";
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = emailSchema.safeParse(email.trim());
    if (!result.success) {
      toast({ title: "Enter a valid email address.", variant: "error" });
      return;
    }

    toast({
      title: "Reset email sent",
      description:
        "If an account with that email exists, instructions have been sent.",
      variant: "info",
    });

    setLoading(true);
    try {
      await sendForgotPassword(result.data);
    } catch {
      // Silently ignore — user already saw the info toast
    }
    window.location.href = `/login?email=${encodeURIComponent(result.data)}`;
  };

  return (
    <NonAuthForm
      title="Forgot Password"
      onSubmit={onSubmit}
      actionButtons={[
        <SecondaryButton
          key="cancel"
          type="button"
          onClick={() => {
            window.location.href = `/login?email=${encodeURIComponent(email)}`;
          }}
        >
          Cancel
        </SecondaryButton>,
        <Button
          key="send"
          type="submit"
          disabled={loading}
          className="h-auto py-2 text-sm"
        >
          {loading ? "Sending..." : "Send Reset Link"}
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
    </NonAuthForm>
  );
};
