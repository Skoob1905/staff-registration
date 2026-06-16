const cls = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");

export const Button = ({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    {...props}
    className={cls(
      "h-7 px-2.5 rounded-xl border border-[var(--primary)]/20 bg-[var(--primary-400)] text-[10px] font-semibold text-white transition-all hover:bg-[var(--primary-500)]/85 hover:shadow-[0_2px_12px_rgba(37,99,235,0.25)] disabled:pointer-events-none disabled:opacity-60 sm:h-8 sm:px-3 sm:text-[11px] md:h-8 md:px-4 md:text-sm",
      className,
    )}
  />
);

export const SecondaryButton = ({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    {...props}
    className={cls(
      "rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--primary)]/[0.06]",
      className,
    )}
  />
);
