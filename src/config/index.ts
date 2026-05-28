import blackrockNavbar from "../assets/blackrock/navbar.jpg";
import blackrockLogin from "../assets/blackrock/login.jpg";
import blackrockLoading from "../assets/blackrock/loading.png";
import cerobiNavbar from "../assets/cerobi/navbar.jpg";
import cerobiLogin from "../assets/cerobi/login.jpg";
import cerobiLoading from "../assets/cerobi/loading.png";
import crsNavbar from "../assets/crs/navbar.jpg";
import crsLogin from "../assets/crs/login.jpg";
import crsLoading from "../assets/crs/loading.png";
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
    allowedDomains: ["blackrockconsultancyuk.com"],
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
    },
  },
  cerobi: {
    navbar: cerobiNavbar,
    login: cerobiLogin,
    loading: cerobiLoading,
    name: "Cerobi Group Ltd",
    homepage: "https://cerobigroup-uk.com/",
    allowedDomains: ["cerobi.com"],
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
    },
  },
  crs: {
    navbar: crsNavbar,
    login: crsLogin,
    loading: crsLoading,
    name: "CRS Group Holding",
    homepage: "https://crs-staffing.com/",
    allowedDomains: ["crs-staffing.com"],
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
};

export function applyTheme() {
  const root = document.documentElement;
  const theme = config.theme;
  for (const [key, cssVar] of Object.entries(cssVarMap)) {
    root.style.setProperty(cssVar, theme[key as keyof Theme]);
  }
}
