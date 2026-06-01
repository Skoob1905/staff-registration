import blackrockNavbar from "../assets/blackrock/navbar.jpg";
import blackrockLogin from "../assets/blackrock/login.jpg";
import blackrockLoading from "../assets/blackrock/loading.jpg";
import cerobiNavbar from "../assets/cerobi/navbar.jpg";
import cerobiLogin from "../assets/cerobi/login.jpg";
import cerobiLoading from "../assets/cerobi/loading.jpg";
import crsNavbar from "../assets/crs/navbar.jpg";
import crsLogin from "../assets/crs/login.jpg";
import crsLoading from "../assets/crs/loading.jpg";
import orbitNavbar from "../assets/crs/navbar.jpg";
import orbitLogin from "../assets/crs/login.jpg";
import orbitLoading from "../assets/crs/loading.jpg";
import type { Config, Theme } from "./types";

const raw = import.meta.env.VITE_COMPANY_NAME ?? "blackrock";
export const slug = raw.toLowerCase();

const images: Record<string, Config> = {
  blackrock: {
    navbar: blackrockNavbar,
    login: blackrockLogin,
    loading: blackrockLoading,
    name: "Blackrock Consultancy UK",
    homepage: "https://blackrockconsultancyuk.com/",
    theme: {
      appBackground: "#f8faf9", // A crisp, clean off-white with a tiny hint of sage/cool undertone
      primaryTextColour: "#1e293b", // Deep slate-charcoal for excellent readability and contrast
      card: "#ffffff", // Bright white cards to create depth against the background
      cardForeground: "#1e293b", // High-contrast slate text inside cards
      muted: "#f0f4f3", // Soft, desaturated teal-gray for hover states and subtle rows
      mutedForeground: "#64748b", // Balanced slate-gray for captions and secondary text
      primary: "#005F57", // Your deep pine teal for primary buttons, links, and accents
      primaryForeground: "#ffffff", // Pure white text for crisp legibility on teal buttons
      border: "#e2e8f0", // Clean, light gray borders to keep the UI structured
      destructive: "#be123c", // A deep, rich crimson that pairs beautifully with teal without clashing
      headerBg: "#ffffff", // Pure white header to ground the top navigation
      surface: "#f1f5f9", // Very light cool gray for secondary buttons or code blocks
      inputBg: "rgba(255, 255, 255, 0.95)", // Clean white for inputs
      inputFocusBg: "#ffffff", // Solid white focus state
      placeholder: "#94a3b8", // Soft gray for input placeholders
      radius: "0.5rem", // standard 8px corners for a clean, professional, structured feel
      typeface: "'Manrope', 'Avenir Next', 'Segoe UI', sans-serif",
    },
  },
  cerobi: {
    navbar: cerobiNavbar,
    login: cerobiLogin,
    loading: cerobiLoading,
    name: "Cerobi Group Ltd",
    homepage: "https://cerobigroup-uk.com/",
    theme: {
      appBackground: "#f8fafc", // Ultra-clean, cool-tinted slate for a modern SaaS backdrop
      primaryTextColour: "#0f172a", // Slate-900 (deep obsidian) for sharp, premium typography
      card: "#ffffff", // Crisp white panels to lift content off the background
      cardForeground: "#0f172a", // High-contrast deep slate text inside cards
      muted: "#f1f5f9", // Light cool gray for hover states and subtle sections
      mutedForeground: "#64748b", // Balanced slate-gray for secondary text and captions
      primary: "#1E5EFF", // Your electric tech blue for buttons, links, and focus states
      primaryForeground: "#ffffff", // Crisp white text for perfect readability on blue buttons
      border: "#e2e8f0", // Thin, elegant dividers that keep the layout structured
      destructive: "#ef4444", // Modern, energetic red for warnings and destructive actions
      headerBg: "#ffffff", // Pure white navigation bar to anchor the top of the page
      surface: "#f8fafc", // Light gray surface for secondary actions or table rows
      inputBg: "rgba(255, 255, 255, 0.95)", // Clean white for text inputs
      inputFocusBg: "#ffffff", // Solid white focus state
      placeholder: "#94a3b8", // Soft gray for input placeholders
      radius: "0.625rem", // Modern 10px corners—not too sharp, not too round
      typeface: "'Manrope', 'Avenir Next', 'Segoe UI', sans-serif",
    },
  },
  crs: {
    navbar: crsNavbar,
    login: crsLogin,
    loading: crsLoading,
    name: "CRS Group Holding",
    homepage: "https://crs-staffing.com/",
    theme: {
      appBackground: "#f4f7f5", // An incredibly soft, mint-tinted gray that makes the green pop
      primaryTextColour: "#0f172a", // Slate-900 (deep charcoal/navy-gray) for maximum readability
      card: "#ffffff", // Pure white cards to create a sharp contrast against the backdrop
      cardForeground: "#0f172a", // Deep slate text inside cards
      muted: "#e2e8f0", // Clean light gray for borders, hovers, and dividers
      mutedForeground: "#475569", // Balanced medium slate for secondary text and captions
      primary: "#008236", // Your vibrant forest green for buttons, badges, and primary links
      primaryForeground: "#ffffff", // Crisp white text to ensure high contrast on green buttons
      border: "#cbd5e1", // Mid-tone gray for clean, defined UI boundaries
      destructive: "#df1c1c", // A bright, clear red for errors and destructive actions
      headerBg: "#ffffff", // Pure white header to ground the top navigation
      surface: "#f8fafc", // A very light slate for secondary buttons or table headers
      inputBg: "rgba(255, 255, 255, 0.95)", // Clean white input fields
      inputFocusBg: "#ffffff", // Pure white on input focus
      placeholder: "#94a3b8", // Muted gray for placeholder text
      radius: "0.5rem", // A sleek, standard 8px radius for a clean digital look
      typeface: "'Manrope', 'Avenir Next', 'Segoe UI', sans-serif",
    },
  },
  orbit: {
    navbar: orbitNavbar,
    login: orbitLogin,
    loading: orbitLoading,
    name: "",
    homepage: "",
    theme: {
      appBackground: "#040916", // Deep space navy, almost black
      primaryTextColour: "#E2E8F0", // Soft cool white
      card: "#040916", // Rich navy card background
      cardForeground: "#F8FAFC", // Clean white text on cards

      muted: "#172554", // Dark orbital blue
      mutedForeground: "#94A3B8", // Subtle slate gray

      primary: "#4F7DAA", // Modern steel-blue from the rocket body
      primaryForeground: "#FFFFFF",

      border: "#0F2A4A", // Muted blue border, subtle presence against dark bg

      destructive: "#DC2626", // Clean red for destructive actions

      headerBg: "#0A1220", // Slightly elevated from background

      surface: "#111C2F", // Secondary panels, sidebars, code blocks

      inputBg: "rgba(15, 23, 42, 0.85)",
      inputFocusBg: "#162338",

      placeholder: "#64748B",

      // Accent colours for charts, badges, indicators
      // accent: "#FF8A1F", // Rocket exhaust orange
      // accentForeground: "#FFFFFF",

      // success: "#22C55E",
      // warning: "#F59E0B",
      // info: "#60A5FA",

      radius: "8px", // 12px feels more modern and premium
      typeface: "'Manrope', 'Avenir Next', 'Segoe UI', sans-serif",
    },
  },
};

export const config = images[slug] ?? images.blackrock;

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

/**
 * THEME SWITCHING LOGIC — uncomment to enable
 */
// import { darkTheme } from "./theme";

// const STORAGE_KEY = "handysign-theme";

// export function getStoredTheme(): "dark" | "light" {
//   if (typeof window === "undefined") return "dark";
//   return (localStorage.getItem(STORAGE_KEY) as "dark" | "light") ?? "dark";
// }

// export function applyTheme(mode?: "dark" | "light") {
//   const theme = mode === "light" ? lightTheme : darkTheme;
//   const root = document.documentElement;
//   for (const [key, cssVar] of Object.entries(cssVarMap)) {
//     root.style.setProperty(cssVar, theme[key as keyof Theme]);
//   }
// }

// export function switchTheme(mode: "dark" | "light") {
//   localStorage.setItem(STORAGE_KEY, mode);
//   applyTheme(mode);
// }

// Apply stored theme on load
// const stored = getStoredTheme();
// if (stored === "light") {
//   config.theme = lightTheme;
// }
// applyTheme(stored);
