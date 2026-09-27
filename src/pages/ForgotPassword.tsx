import { useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { Mail } from "lucide-react";
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
      submitTitle="Send Reset Link"
      loadingTitle="Sending..."
      onSubmit={onSubmit}
      loading={loading}
      minHeight="auto"
      inputs={[
        {
          id: "email",
          value: email,
          onChange: setEmail,
          placeholder: "you@agency.com",
          icon: <Mail className="h-4 w-4" />,
        },
      ]}
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
    />
  );
};
