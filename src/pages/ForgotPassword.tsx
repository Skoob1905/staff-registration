import { useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { Button, Input, Label, SecondaryButton } from "../components/ui";
import { NonAuthForm } from "../components/NonAuthForm";
import { sendForgotPassword } from "../services/authService";
import { useToast } from "../context/ToastProvider";
import { toast_mapper, ToastType } from "../config/toast";

const emailSchema = z.string().email("Enter a valid email address.");

export const ForgotPassword = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialEmail = location.state?.email ?? searchParams.get("email") ?? "";
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = emailSchema.safeParse(email.trim());
    if (!result.success) {
      toast(toast_mapper[ToastType.INVALID_EMAIL_FORMAT]);
      return;
    }

    setLoading(true);
    try {
      await sendForgotPassword(result.data);
    } finally {
      navigate("/login", {
        state: { email: result.data, source: "forgot-password" },
      });
    }
  };

  return (
    <NonAuthForm
      title="Forgot Password"
      subtitle="Enter your email and we'll send you a reset link"
      onSubmit={onSubmit}
      footer={
        <div className="flex justify-end">
          <a
            href={`/login?email=${encodeURIComponent(email)}`}
            className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            Back to login
          </a>
        </div>
      }
      actionButtons={[
        <SecondaryButton
          key="cancel"
          type="button"
          onClick={() => {
            navigate("/login", { state: { email } });
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
