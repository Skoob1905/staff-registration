import { type ReactNode, useEffect } from "react";
import { Card } from "./ui";
import { H1, Muted } from "../config/typography";
import { config } from "../config";

interface NonAuthFormProps {
  children: ReactNode;
  actionButtons?: ReactNode[];
  title?: string;
  subtitle?: string;
  footer?: ReactNode;
  onSubmit?: (e: React.FormEvent) => void;
}

export const NonAuthForm = ({
  children,
  actionButtons,
  title,
  subtitle,
  footer,
  onSubmit,
}: NonAuthFormProps) => {
  useEffect(() => {
    document.title = title ?? "";
  }, [title]);

  useEffect(() => {
    const vp = document.querySelector("[data-toast-viewport]");
    vp?.classList.add("toast-non-auth");
    return () => vp?.classList.remove("toast-non-auth");
  }, []);

  const formBody = (
    <>
      <div className="flex flex-col items-center mb-3">
        <img
          src={config.login}
          alt={config.name}
          className="w-auto h-auto max-h-[16vh] object-contain"
        />
      </div>

      {title ? (
        <H1 className="text-center text-lg sm:text-xl whitespace-nowrap">{title}</H1>
      ) : null}

      {subtitle ? (
        <Muted className="mb-6 text-center">{subtitle}</Muted>
      ) : null}

      <div className="space-y-3">
        {children}
        {actionButtons && actionButtons.length > 0 && (
          <div className="flex grow gap-2">
            {actionButtons.map((btn, i) => (
              <div key={i} className="flex-1 self-stretch [&>button]:w-full [&>button]:h-full">
                {btn}
              </div>
            ))}
          </div>
        )}
      </div>

      {footer ? (
        <>
          <div className="mt-6 border-t border-[var(--border)]" />
          <div className="mt-4">{footer}</div>
        </>
      ) : null}
    </>
  );

  return (
    <div className="flex h-dvh w-dvw items-center justify-center px-4 app-bg">
      <Card className="w-full max-w-md">
        {onSubmit ? (
          <form onSubmit={onSubmit}>{formBody}</form>
        ) : (
          formBody
        )}
      </Card>
    </div>
  );
};
