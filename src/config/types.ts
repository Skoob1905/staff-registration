import type { ReactNode } from "react";

export type Theme = {
  appBackground: string; // Page background
  primaryTextColour: string; // Main text color
  card: string; // Card/panel background
  cardForeground: string; // Text inside cards
  muted: string; // Subtle divider/hover backgrounds
  mutedForeground: string; // Secondary/less important text
  primary: string; // Primary brand color (buttons, links)
  primaryForeground: string; // Text on primary backgrounds
  border: string; // Borders and dividers
  destructive: string; // Delete/error actions
  headerBg: string; // Top navigation bar background
  surface: string; // Secondary surface (e.g. secondary buttons)
  inputBg: string; // Input field background
  inputFocusBg: string; // Input field background when focused
  placeholder: string; // Input placeholder text color
  radius: string; // Global border-radius
  typeface: string; // Font-family stack
};

export type Config = {
  navbar: string;
  // navbarDark: string;
  // navbarLight: string;
  login: string;
  loading: string;
  name: string;
  homepage: string;
  theme: Theme;
};

export type TypoProps = {
  children: ReactNode;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
};
