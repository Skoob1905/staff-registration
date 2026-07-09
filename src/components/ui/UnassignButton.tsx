const cls = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");

export const UnassignButton = ({
  className,
  children = "Unassign",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    {...props}
    className={cls(
      "inline-flex items-center gap-1.5 h-7 px-2.5 sm:h-8 sm:px-3 rounded-xl border border-amber-400/20 bg-amber-400 text-[10px] sm:text-[11px] font-semibold text-white transition-all hover:bg-amber-500 hover:shadow-[0_2px_12px_rgba(245,158,11,0.25)] disabled:pointer-events-none disabled:opacity-60",
      className,
    )}
  >
    {children}
  </button>
);
