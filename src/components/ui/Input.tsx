import { forwardRef } from "react";

const cls = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  (props, ref) => (
    <input
      ref={ref}
      {...props}
      className={cls(
        "w-full rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--placeholder)] outline-none transition focus:border-[var(--primary)] focus:bg-[var(--input-focus-bg)]",
        props.className,
      )}
    />
  ),
);

Input.displayName = "Input";
