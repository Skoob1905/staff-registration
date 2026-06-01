import type { ReactNode } from "react";

export const Label = ({
  children,
  htmlFor,
}: {
  children: ReactNode;
  htmlFor?: string;
}) => (
  <label
    htmlFor={htmlFor}
    className="text-sm font-medium text-[var(--muted-foreground)]"
  >
    {children}
  </label>
);
