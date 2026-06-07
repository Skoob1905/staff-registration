import { el } from "../components/el";
import type { TypoProps } from "./types";

export const H1 = (props: TypoProps) =>
  el("h2", "text-base sm:text-lg font-bold text-[var(--foreground)]", props);

export const H2 = (props: TypoProps) =>
  el("h3", "text-sm sm:text-base font-bold text-[var(--foreground)]", props);

export const H3 = (props: TypoProps) =>
  el("h4", "text-sm font-semibold text-[var(--foreground)]", props);

export const Body = (props: TypoProps) =>
  el("p", "text-[11px] sm:text-sm text-[var(--foreground)]", props);

export const BodyBold = (props: TypoProps) =>
  el("p", "text-[11px] sm:text-sm font-semibold text-[var(--foreground)]", props);

export const BodyMedium = (props: TypoProps) =>
  el("p", "text-[11px] sm:text-sm font-medium text-[var(--foreground)]", props);

export const Muted = (props: TypoProps) =>
  el("p", "text-[11px] sm:text-sm text-[var(--muted-foreground)]", props);

export const Caption = (props: TypoProps) =>
  el("p", "text-[11px] text-[var(--muted-foreground)]", props);

export const Label = (props: TypoProps) =>
  el("label", "text-[11px] sm:text-sm font-medium text-[var(--foreground)]", props);
