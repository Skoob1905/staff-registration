export type LoginStatusValue = "all" | "sent" | "not_sent";

const SENT = ["awaiting_login", "password_set", "logged_in"] as const;

interface IsLoggedInProps {
  value: LoginStatusValue;
  onChange: (value: LoginStatusValue) => void;
}

const options: { value: LoginStatusValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "sent", label: "Email Sent" },
  { value: "not_sent", label: "Email Not Sent" },
];

export const IsLoggedIn = ({ value, onChange }: IsLoggedInProps) => (
  <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] p-0.5">
    {options.map((opt) => (
      <button
        key={opt.value}
        type="button"
        onClick={() => onChange(opt.value)}
        className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
          value === opt.value
            ? "bg-[var(--primary)] text-white shadow-sm"
            : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        }`}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

export function buildLoginStatusFilter(
  value: LoginStatusValue,
): { facetFilters?: string[][]; filterExpr?: string } {
  if (value === "all") return {};

  if (value === "sent") {
    return { facetFilters: [SENT.map((s) => `metadata.loginStatus:${s}`)] };
  }

  return {
    filterExpr: SENT.map((s) => `NOT metadata.loginStatus:${s}`).join(" AND "),
  };
}
