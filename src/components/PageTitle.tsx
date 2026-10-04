import type { ReactNode } from "react";

/**
 * Standard page/section title row. Keeps the title height and horizontal
 * position identical across pages, whether or not an action is present.
 */
export const PageTitle = ({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) => (
  <div className="flex min-h-[2.25rem] items-center justify-between gap-2 px-4">
    <h2 className="shrink-0 text-base sm:text-lg font-bold text-[var(--foreground)]">
      {children}
    </h2>
    {action ? (
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        {action}
      </div>
    ) : null}
  </div>
);
