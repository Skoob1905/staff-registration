import type { LoginStatusValue } from "../../types/domain";

interface IsLoggedInProps {
  value: LoginStatusValue;
  onChange: (value: LoginStatusValue) => void;
}

const LOGIN_STATUS_LABELS: Record<LoginStatusValue, string> = {
  all: "All",
  awaiting_login: "Email Sent",
  password_set: "Password Reset",
  logged_in: "Logged In",
};

const options = Object.entries(LOGIN_STATUS_LABELS) as [
  LoginStatusValue,
  string
][];

export const IsLoggedIn = ({ value, onChange }: IsLoggedInProps) => (
  <div className="flex w-fit items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] p-0.5">
    {options.map(([optValue, label]) => (
      <button
        key={optValue}
        type="button"
        onClick={() => onChange(optValue)}
        className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
          value === optValue
            ? "bg-[var(--primary)] text-white shadow-sm"
            : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        }`}
      >
        {label}
      </button>
    ))}
  </div>
);
