/* eslint-disable react-refresh/only-export-components */

import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

export const AccordionRoot = Accordion.Root;

export const AccordionItem = ({
  value,
  title,
  children,
  actions,
  className,
  style,
}: {
  value: string;
  title: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) => (
  <Accordion.Item
    value={value}
    className={`border-b border-[var(--border)] last:border-b-0${className ? ` ${className}` : ""}`}
    style={style}
  >
    <Accordion.Header className="group/header flex items-center">
      <Accordion.Trigger className="flex flex-1 items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-[var(--foreground)] sm:px-4 sm:py-3 sm:text-sm">
        <span className="flex-1 min-w-0">{title}</span>
        {actions && (
          <div
            className="flex shrink-0 items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        )}
        <ChevronDown className="h-4 w-4 shrink-0 text-[var(--muted-foreground)] transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
      </Accordion.Trigger>
    </Accordion.Header>
    <Accordion.Content className="px-3 pb-3 text-xs text-[var(--muted-foreground)] sm:px-4 sm:pb-4 sm:text-sm">
      {children}
    </Accordion.Content>
  </Accordion.Item>
);
