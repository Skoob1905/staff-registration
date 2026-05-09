import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

const cls = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

export const Card = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cls("rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_10px_30px_rgba(24,24,27,0.06)]", className)}>
    {children}
  </div>
);

export const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className={cls(
      "w-full rounded-xl border border-[var(--border)] bg-zinc-50/40 px-3 py-2 text-sm outline-none transition focus:border-zinc-500 focus:bg-white",
      props.className,
    )}
  />
);

export const Button = ({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    {...props}
    className={cls(
      "rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60",
      className,
    )}
  />
);

export const SecondaryButton = ({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    {...props}
    className={cls(
      "rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50",
      className,
    )}
  />
);

export const Label = ({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) => (
  <label htmlFor={htmlFor} className="text-sm font-medium text-zinc-700">
    {children}
  </label>
);

export const Alert = ({ children }: { children: ReactNode }) => (
  <div className="rounded-xl border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm text-zinc-800">{children}</div>
);

export const Separator = () => <div className="my-4 h-px w-full bg-[var(--muted)]" />;

export const ProgressBar = ({ value }: { value: number }) => (
  <div className="h-2 w-full rounded-full bg-zinc-200">
    <div className="h-2 rounded-full bg-zinc-700 transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
  </div>
);

export const AccordionRoot = Accordion.Root;

export const AccordionItem = ({ value, title, children }: { value: string; title: ReactNode; children: ReactNode }) => (
  <Accordion.Item value={value} className="rounded-xl border border-[var(--border)] bg-white shadow-[0_4px_18px_rgba(24,24,27,0.04)]">
    <Accordion.Header>
      <Accordion.Trigger className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-zinc-800">
        {title}
        <ChevronDown className="h-4 w-4" />
      </Accordion.Trigger>
    </Accordion.Header>
    <Accordion.Content className="px-4 pb-4 text-sm text-zinc-600">{children}</Accordion.Content>
  </Accordion.Item>
);
