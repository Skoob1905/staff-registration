const cls = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");

export const AssignButton = ({
  className,
  children = "Assign",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    {...props}
    className={cls(
      "inline-flex items-center gap-1.5 h-7 px-2.5 sm:h-8 sm:px-3 rounded-xl border border-emerald-400/20 bg-emerald-400 text-[10px] sm:text-[11px] font-semibold text-white transition-all hover:bg-emerald-500 hover:shadow-[0_2px_12px_rgba(16,185,129,0.25)] disabled:pointer-events-none disabled:opacity-60",
      className,
    )}
  >
    {children}
  </button>
);
