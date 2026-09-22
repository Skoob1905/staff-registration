import { useSearchParams } from "react-router-dom";

const TABS = ["Records", "History"] as const;

export const SecondaryNavbar = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") ?? "records";

  const setTab = (next: string) =>
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === "records") params.delete("tab");
        else params.set("tab", next);
        return params;
      },
      { replace: true }
    );

  return (
    <nav
      className="flex rounded-lg border border-[var(--border)] bg-[var(--muted)] p-0.5"
      aria-label="Records navigation"
    >
      {TABS.map((t) => {
        const value = t.toLowerCase();
        const isActive = tab === value;
        return (
          <button
            key={t}
            type="button"
            onClick={() => setTab(value)}
            className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-colors sm:px-5 sm:text-sm ${
              isActive
                ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            {t}
          </button>
        );
      })}
    </nav>
  );
};
