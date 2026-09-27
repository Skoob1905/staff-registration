import type { Config, Theme } from "./types";

const unifiedTheme: Theme = {
  appBackground: "#F8FAFC",
  primaryTextColour: "#0F172A",
  card: "#FFFFFF",
  cardForeground: "#0F172A",
  muted: "#F1F5F9",
  mutedForeground: "#64748B",
  primary: "#2563EB",
  primaryForeground: "#FFFFFF",
  border: "#E2E8F0",
  destructive: "#DC2626",
  headerBg: "#FFFFFF",
  surface: "#F1F5F9",
  inputBg: "#FFFFFF",
  inputFocusBg: "#FFFFFF",
  placeholder: "#94A3B8",
  radius: "0.5rem",
  typeface: "'Outfit', 'Avenir Next', 'Segoe UI', sans-serif",
};

// All images/assets are served from the `public/` directory.
export const config: Config = {
  navbar: "/logo.png",
  login: "/logo.png",
  loading: "/logo.png",
  name: "MDS Consultancy & Engineering",
  homepage: "",
  theme: unifiedTheme,
};

const cssVarMap: Record<keyof Theme, string> = {
  appBackground: "--background",
  primaryTextColour: "--foreground",
  card: "--card",
  cardForeground: "--card-foreground",
  muted: "--muted",
  mutedForeground: "--muted-foreground",
  primary: "--primary",
  primaryForeground: "--primary-foreground",
  border: "--border",
  destructive: "--destructive",
  headerBg: "--header-bg",
  surface: "--surface",
  inputBg: "--input-bg",
  inputFocusBg: "--input-focus-bg",
  placeholder: "--placeholder",
  radius: "--radius",
  typeface: "--font-family",
};

export function applyTheme() {
  const root = document.documentElement;
  for (const [key, cssVar] of Object.entries(cssVarMap)) {
    root.style.setProperty(cssVar, config.theme[key as keyof Theme]);
  }
}

applyTheme();
