const cls = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");

export const Button = ({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    {...props}
    className={cls(
      "h-8 rounded-xl border border-transparent bg-[var(--primary)]/80 px-3 text-xs font-semibold text-[var(--primary-foreground)] shadow-[0_3px_10px_var(--primary)/12] transition hover:bg-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-60 md:h-8 md:px-4 md:text-sm",
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
