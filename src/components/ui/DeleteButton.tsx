const cls = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");

export const DeleteButton = ({
  className,
  children = "Delete",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    {...props}
    className={cls(
      "inline-flex items-center gap-1.5 h-7 px-2.5 sm:h-8 sm:px-3 rounded-xl border border-[var(--destructive)]/20 bg-[var(--destructive-400)] text-[10px] sm:text-[11px] font-semibold text-white transition-all hover:bg-[var(--destructive-500)]/85 hover:shadow-[0_2px_12px_rgba(220,38,38,0.25)] disabled:pointer-events-none disabled:opacity-60",
      className,
    )}
  >
    {children}
  </button>
);
