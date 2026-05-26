import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

const cls = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");

export const Card = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div
    className={cls(
      "rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-[0_12px_28px_rgba(18,50,92,0.10)] sm:p-4",
      className,
    )}
  >
    {children}
  </div>
);

export const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className={cls(
      "w-full rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--placeholder)] outline-none transition focus:border-[var(--primary)] focus:bg-[var(--input-focus-bg)]",
      props.className,
    )}
  />
);

export const Button = ({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    {...props}
    className={cls(
      "h-8 rounded-xl border border-transparent bg-[color:rgba(0,95,87,0.80)] px-3 text-xs font-semibold text-[var(--primary-foreground)] shadow-[0_3px_10px_rgba(0,95,87,0.12)] transition hover:bg-[color:rgba(0,95,87,0.92)] disabled:cursor-not-allowed disabled:opacity-60 md:h-8 md:px-4 md:text-sm",
      className,
    )}
  />
);

export const SecondaryButton = ({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    {...props}
    className={cls(
      "rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[color:rgba(0,95,87,0.06)]",
      className,
    )}
  />
);

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

export const Alert = ({ children }: { children: ReactNode }) => (
  <div className="rounded-xl border border-[var(--border)] bg-[color:rgba(0,95,87,0.08)] px-3 py-2 text-sm text-[var(--foreground)]">
    {children}
  </div>
);

export const Separator = () => (
  <div className="my-4 h-px w-full bg-[var(--muted)]" />
);

export const ProgressBar = ({ value }: { value: number }) => (
  <div className="h-2 w-full rounded-full bg-[color:rgba(0,95,87,0.15)]">
    <div
      className="h-2 rounded-full bg-[var(--primary)] transition-all"
      style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
    />
  </div>
);

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
    <Accordion.Header className="flex items-center">
      <Accordion.Trigger className="flex flex-1 items-center px-3 py-2 text-left text-xs font-semibold text-[var(--foreground)] sm:px-4 sm:py-3 sm:text-sm">
        <span className="flex-1 min-w-0">{title}</span>
        {actions && (
          <div className="ml-auto mr-1 flex shrink-0 items-center gap-2 sm:mr-2" onClick={(e) => e.stopPropagation()}>
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
