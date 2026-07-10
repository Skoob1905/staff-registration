import { type ReactNode, useEffect } from "react";
import { Card } from "./ui";
import { config } from "../config";

interface NonAuthFormProps {
  children: ReactNode;
  actionButtons?: ReactNode[];
  title?: string;
  onSubmit?: (e: React.FormEvent) => void;
}

export const NonAuthForm = ({
  children,
  actionButtons,
  title,
  onSubmit,
}: NonAuthFormProps) => {
  useEffect(() => {
    document.title = title ?? "";
  }, [title]);

  const formBody = (
    <>
      {/* <div className="flex flex-col items-center gap-8 mb-6">
        <img
          src={config.login}
          alt={config.name}
          className="w-auto h-auto max-h-[20vh] object-contain"
        />
      </div> */}

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
    </>
  );

  return (
    <div className="flex min-h-screen items-center justify-center px-4 app-bg">
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
