const cls = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");

export const Button = ({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    {...props}
    className={cls(
      "flex items-center justify-center h-7 px-2.5 rounded-xl border border-[var(--primary-border)] bg-[var(--primary)] text-[10px] font-semibold text-[var(--primary-foreground)] transition-all hover:bg-[var(--primary-hover)] hover:shadow-[0_2px_12px_var(--primary-shadow)] disabled:pointer-events-none disabled:opacity-60 sm:h-8 sm:px-3 sm:text-[11px] md:h-8 md:px-4 md:text-sm",
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
      "flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-all hover:border-[var(--primary-border)] hover:bg-[var(--primary-tint)] hover:shadow-[0_2px_8px_rgba(31,141,135,0.08)]",
      className,
    )}
  />
);
