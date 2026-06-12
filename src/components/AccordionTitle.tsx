import type { ReactNode } from "react";

export const AccordionTitle = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <span className={`min-w-0 font-semibold ${className ?? ""}`.trim()}>
    {children}
  </span>
);
