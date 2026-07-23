const cls = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");

export const SendLinkButton = ({
  className,
  children = "Send Link",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    {...props}
    className={cls(
      "inline-flex items-center gap-1.5 h-7 px-2.5 sm:h-8 sm:px-3 rounded-xl border border-violet-400/20 bg-violet-400 text-[10px] sm:text-[11px] font-semibold text-white transition-all hover:bg-violet-500 hover:shadow-[0_2px_12px_rgba(139,92,246,0.25)] disabled:pointer-events-none disabled:opacity-60",
      className,
    )}
  >
    {children}
  </button>
);
