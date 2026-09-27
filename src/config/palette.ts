export const palette = {
  primaryBlue: {
    100: "#EFF6FF",
    200: "#DBEAFE",
    300: "#93C5FD",
    400: "#60A5FA",
    500: "#2563EB",
  },
  primaryDark: {
    100: "#EEF2FF",
    200: "#CBD5E1",
    300: "#94A3B8",
    400: "#475569",
    500: "#1E3A8A",
  },
  accentTeal: {
    100: "#ECFDF5",
    200: "#CCFBF1",
    300: "#99F6E4",
    400: "#5EEAD4",
    500: "#14B8A6",
    600: "#1F8D87",
  },
  secondarySlate: {
    100: "#F1F5F9",
    200: "#E2E8F0",
    300: "#CBD5E1",
    400: "#94A3B8",
    500: "#64748B",
  },
  destructiveRed: {
    100: "#FEF2F2",
    200: "#FEE2E2",
    300: "#FECACA",
    400: "#F87171",
    500: "#DC2626",
  },
  neutrals: {
    background: "#F8FAFC",
    surfaceCards: "#FFFFFF",
    border: "#E2E8F0",
    textPrimary: "#0F172A",
    textSecondary: "#475569",
    textMuted: "#94A3B8",
    inputBorderDefault: "#F2F2F2",
    inputBorderSelected: "#E7ECFE",
    black: "#000000",
  },
} as const;

export type Palette = typeof palette;
