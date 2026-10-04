/* eslint-disable react-refresh/only-export-components */

import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

export const AccordionRoot = Accordion.Root;

export type AccordionColumn =
  | ReactNode
  | { node: ReactNode; className?: string };

const isColumnConfig = (
  cell: AccordionColumn,
): cell is { node: ReactNode; className?: string } =>
  cell !== null && typeof cell === "object" && "node" in cell;

export const AccordionItem = ({
  value,
  title,
  columns,
  children,
  actions,
  className,
  style,
}: {
  value: string;
  title?: ReactNode;
  columns?: AccordionColumn[];
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) => (
  <Accordion.Item
    value={value}
    className={`border-b border-[var(--border)]${className ? ` ${className}` : ""}`}
    style={style}
  >
    <Accordion.Header className="group/header flex items-center">
      <Accordion.Trigger className="flex w-full items-center justify-between gap-3 px-3 py-2 min-h-[3rem] text-left text-sm font-semibold text-[var(--foreground)] sm:px-4 sm:text-sm">
        {columns ? (
          <>
            <span className="w-8 shrink-0 text-left text-[var(--muted-foreground)]">
              {isColumnConfig(columns[0]) ? columns[0].node : columns[0]}
            </span>
            {columns.slice(1).map((cell, i) => {
              const node = isColumnConfig(cell) ? cell.node : cell;
              const width = isColumnConfig(cell)
                ? cell.className ?? "flex-1"
                : "flex-1";
              return (
                <span
                  key={i}
                  className={`min-w-0 overflow-hidden text-left text-ellipsis whitespace-nowrap ${width} ${
                    i > 0 ? "hidden sm:block" : ""
                  }`}
                >
                  {node}
                </span>
              );
            })}
          </>
        ) : (
          <span className="min-w-0 flex-1 font-semibold">{title}</span>
        )}
        {actions && (
          <div
            className="hidden sm:flex shrink-0 items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        )}
        <ChevronDown className="h-4 w-4 shrink-0 text-[var(--muted-foreground)] transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
      </Accordion.Trigger>
    </Accordion.Header>
    <Accordion.Content className="w-0 min-w-full overflow-hidden overflow-x-auto data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up px-3 pb-3 text-[11px] text-[var(--muted-foreground)] sm:px-4 sm:pb-4 sm:text-sm">
      {children}
    </Accordion.Content>
  </Accordion.Item>
);
