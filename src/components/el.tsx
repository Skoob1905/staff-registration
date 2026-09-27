import type { TypoProps } from "../config/types";

export function el(
  Tag: keyof React.JSX.IntrinsicElements,
  base: string,
  { children, className = "", as, style }: TypoProps,
) {
  const Comp = as ?? Tag;
  return (
    <Comp className={`${base} ${className}`.trim()} style={style}>
      {children}
    </Comp>
  );
}
