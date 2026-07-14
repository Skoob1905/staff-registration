export function AccordionAction({ children }: { children: string }) {
  return (
    <span className="text-xs sm:text-sm font-medium text-[var(--muted-foreground)] whitespace-nowrap">
      {children}
    </span>
  );
}
