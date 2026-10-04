import { forwardRef, type ReactNode } from "react";
import { palette } from "../../config/palette";

const cls = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");

const base =
  "w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm placeholder:text-[var(--placeholder)] outline-none transition focus:border-[var(--input-border-focus)] focus:bg-[var(--input-focus-bg)]";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode;
  trailingIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ icon, trailingIcon, className, style, ...props }, ref) => {
    const inputStyle: React.CSSProperties & Record<string, string> = {
      "--input-border": palette.neutrals.inputBorderDefault,
      "--input-border-focus": palette.neutrals.inputBorderSelected,
      color: palette.neutrals.black,
      ...(style as Record<string, string>),
      ...(icon ? { paddingLeft: "52px" } : {}),
      ...(trailingIcon ? { paddingRight: "52px" } : {}),
    };

    const input = (
      <input
        ref={ref}
        {...props}
        className={cls(base, className)}
        style={inputStyle}
      />
    );

    if (!icon && !trailingIcon) return input;

    return (
      <div className="relative w-full">
        {icon && (
          <span
            className="pointer-events-none absolute left-4 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center"
            style={{ color: palette.neutrals.black }}
          >
            {icon}
          </span>
        )}
        {input}
        {trailingIcon && (
          <span
            className="absolute right-4 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center"
            style={{ color: palette.neutrals.black }}
          >
            {trailingIcon}
          </span>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
