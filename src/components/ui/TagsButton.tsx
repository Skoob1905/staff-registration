const cls = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");

export const TagsButton = ({
  className,
  children = "Tags",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    {...props}
    className={cls(
      "inline-flex items-center gap-1.5 h-7 px-2.5 sm:h-8 sm:px-3 rounded-xl border border-[var(--primary)]/20 bg-[var(--primary-400)] text-[10px] sm:text-[11px] font-semibold text-white transition-all hover:bg-[var(--primary-500)] hover:shadow-[0_2px_12px_rgba(59,130,246,0.25)] disabled:pointer-events-none disabled:opacity-60",
      className,
    )}
  >
    {children}
  </button>
);
