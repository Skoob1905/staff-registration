import type { ReactNode } from "react";
import { Card } from "./ui";

interface SectionProps {
  title: string;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export const Section = ({ title, count, action, children, className }: SectionProps) => (
  <Card className={className}>
    <div className="flex items-center justify-between">
      <h2 className="text-base sm:text-lg font-bold text-[var(--foreground)]">
        {title}
        {count !== undefined && ` (${count})`}
      </h2>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
    <div className="mt-1.5 sm:mt-3">{children}</div>
  </Card>
);
