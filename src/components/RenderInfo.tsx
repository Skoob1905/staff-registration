interface RenderInfoProps {
  label: string;
  value: string;
  delay: number;
}

export const RenderInfo = ({ label, value, delay }: RenderInfoProps) => (
  <p
    className="whitespace-nowrap px-1 animate-cascade"
    style={{ animationDelay: `${delay}ms` } as React.CSSProperties}
  >
    <span className="font-medium text-[var(--foreground)]">{label}</span>
    <span className="font-medium">: {value}</span>
  </p>
);
