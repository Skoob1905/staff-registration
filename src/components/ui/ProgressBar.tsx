export const ProgressBar = ({ value }: { value: number }) => (
  <div className="h-2 w-full rounded-full bg-[var(--primary)]/15">
    <div
      className="h-2 rounded-full bg-[var(--primary)] transition-all"
      style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
    />
  </div>
);
