import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

const cls = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

export const Card = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cls("rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_12px_28px_rgba(18,50,92,0.10)]", className)}>
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

export const Button = ({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    {...props}
    className={cls(
      "h-8 rounded-xl border border-transparent bg-[color:rgba(31,79,138,0.80)] px-3 text-xs font-semibold text-[var(--primary-foreground)] shadow-[0_3px_10px_rgba(31,79,138,0.12)] transition hover:bg-[color:rgba(31,79,138,0.92)] disabled:cursor-not-allowed disabled:opacity-60 md:h-8 md:px-4 md:text-sm",
      className,
    )}
  />
);

export const SecondaryButton = ({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    {...props}
    className={cls(
      "rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[color:rgba(31,79,138,0.06)]",
      className,
    )}
  />
);

export const Label = ({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) => (
  <label htmlFor={htmlFor} className="text-sm font-medium text-[var(--muted-foreground)]">
    {children}
  </label>
);

export const Alert = ({ children }: { children: ReactNode }) => (
  <div className="rounded-xl border border-[var(--border)] bg-[color:rgba(31,79,138,0.08)] px-3 py-2 text-sm text-[var(--foreground)]">{children}</div>
);

export const Separator = () => <div className="my-4 h-px w-full bg-[var(--muted)]" />;

export const ProgressBar = ({ value }: { value: number }) => (
  <div className="h-2 w-full rounded-full bg-[color:rgba(31,79,138,0.15)]">
    <div className="h-2 rounded-full bg-[var(--primary)] transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
  </div>
);

export const AccordionRoot = Accordion.Root;

export const AccordionItem = ({ value, title, children, actions }: { value: string; title: ReactNode; children: ReactNode; actions?: ReactNode }) => (
  <Accordion.Item value={value} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_6px_20px_rgba(18,50,92,0.08)]">
    <Accordion.Header className="flex items-center">
      <Accordion.Trigger className="flex flex-1 items-center px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">
        {title}
      </Accordion.Trigger>
      {actions && <div className="mr-2 flex shrink-0 items-center gap-2">{actions}</div>}
      <ChevronDown className="mr-4 h-4 w-4 shrink-0" />
    </Accordion.Header>
    <Accordion.Content className="px-4 pb-4 text-sm text-[var(--muted-foreground)]">{children}</Accordion.Content>
  </Accordion.Item>
);
