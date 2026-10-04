import { type ReactNode, useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button, Input } from "./ui";
import { H1 } from "../config/typography";
import { config } from "../config";
import { palette } from "../config/palette";

export interface TextInput {
  id: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  autoFocus?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  icon?: ReactNode;
}

interface NonAuthFormProps {
  title: string;
  inputs: TextInput[];
  submitTitle: string;
  onSubmit: (e: React.FormEvent) => void;
  loading?: boolean;
  loadingTitle?: string;
  forgotPasswordHref?: string;
  forgotPasswordLabel?: string;
  footer?: ReactNode;
  minHeight?: number | string;
}

export const NonAuthForm = ({
  title,
  inputs,
  submitTitle,
  onSubmit,
  loading = false,
  loadingTitle,
  forgotPasswordHref,
  forgotPasswordLabel = "Forgot password?",
  footer,
  minHeight = 384,
}: NonAuthFormProps) => {
  const [visible, setVisible] = useState<Record<string, boolean>>({});

  useEffect(() => {
    document.title = title;
  }, [title]);

  useEffect(() => {
    const vp = document.querySelector("[data-toast-viewport]");
    vp?.classList.add("toast-non-auth");
    return () => vp?.classList.remove("toast-non-auth");
  }, []);

  return (
    <div className="flex min-h-dvh w-dvw items-center justify-center px-2 py-2">
      <form
        onSubmit={onSubmit}
        className="flex w-full max-w-md flex-col justify-between gap-6 rounded-[var(--radius)] animate-border-flow bg-[var(--card)] shadow-[0_12px_28px_rgba(18,50,92,0.10)]"
        style={{
          padding: 20,
          border: `2px solid ${palette.neutrals.inputBorderDefault}`,
          boxShadow: "none",
          minHeight,
        }}
      >
        {/* Top — logo */}
        <div className="flex justify-center">
          <img
            src={config.login}
            alt={config.name}
            className="h-[100px] w-auto object-contain"
          />
        </div>

        {/* Middle — title, inputs, forgot password */}
        <div className="flex flex-col items-center justify-between gap-4 text-center">
          <H1
            className="text-center text-lg sm:text-xl whitespace-nowrap"
            style={{ fontWeight: 500 }}
          >
            {title}
          </H1>

          <div className="flex w-[370px] max-w-full flex-col gap-3">
            {inputs.map((input) => {
              const isPassword = input.type === "password";
              const shown = visible[input.id] ?? false;
              return (
                <Input
                  key={input.id}
                  id={input.id}
                  ref={input.inputRef}
                  type={isPassword ? (shown ? "text" : "password") : input.type}
                  value={input.value}
                  onChange={(e) => input.onChange(e.target.value)}
                  placeholder={input.placeholder}
                  autoFocus={input.autoFocus}
                  icon={input.icon}
                  trailingIcon={
                    isPassword ? (
                      <button
                        type="button"
                        onClick={() =>
                          setVisible((v) => ({ ...v, [input.id]: !shown }))
                        }
                        className="flex h-5 w-5 items-center justify-center"
                        style={{ color: palette.neutrals.black }}
                        aria-label={shown ? "Hide password" : "Show password"}
                      >
                        {shown ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    ) : undefined
                  }
                  className="h-14 text-left"
                />
              );
            })}
          </div>

          {forgotPasswordHref ? (
            <a
              href={forgotPasswordHref}
              className="text-center text-sm text-cyan-500 underline transition-colors hover:text-cyan-600"
            >
              {forgotPasswordLabel}
            </a>
          ) : null}
        </div>

        {/* Bottom — full-width submit button */}
        <div className="flex flex-col gap-3">
          <Button
            type="submit"
            disabled={loading}
            className="self-center"
            style={{
              width: 370,
              maxWidth: "100%",
              height: 50,
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            {loading ? loadingTitle ?? "Please wait..." : submitTitle}
          </Button>
          {footer}
        </div>
      </form>
    </div>
  );
};
