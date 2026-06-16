import blackrockNavbar from "../assets/blackrock/navbar.jpg";
import blackrockLogin from "../assets/blackrock/login.jpg";
import blackrockLoading from "../assets/blackrock/loading.jpg";
import cerobiNavbar from "../assets/cerobi/navbar.jpg";
import cerobiLogin from "../assets/cerobi/login.jpg";
import cerobiLoading from "../assets/cerobi/loading.jpg";
import crsNavbar from "../assets/crs/navbar.jpg";
import crsLogin from "../assets/crs/login.jpg";
import crsLoading from "../assets/crs/loading.jpg";
import orbitNavbar from "../assets/orbit/navbar.jpg";
import orbitLogin from "../assets/orbit/login.jpg";
import orbitLoading from "../assets/orbit/loading.jpg";
import tierOneNavbar from "../assets/tierOne/navbar.jpg";
import tierOneLogin from "../assets/tierOne/login.jpg";
import tierOneLoading from "../assets/tierOne/loading.jpg";
import mumentumNavbar from "../assets/mumentum/navbar.jpg";
import mumentumLogin from "../assets/mumentum/login.jpg";
import mumentumLoading from "../assets/mumentum/loading.jpg";
import wasNavbar from "../assets/was/navbar.jpg";
import wasLogin from "../assets/was/login.jpg";
import wasLoading from "../assets/was/loading.jpg";
import type { Config, Theme } from "./types";

const raw = import.meta.env.VITE_COMPANY_NAME ?? "blackrock";
export const slug = raw.toLowerCase();

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
  typeface: "'Manrope', 'Avenir Next', 'Segoe UI', sans-serif",
};

const images: Record<string, Config> = {
  blackrock: {
    navbar: blackrockNavbar,
    login: blackrockLogin,
    loading: blackrockLoading,
    name: "Blackrock Consultancy UK Ltd",
    homepage: "https://blackrockconsultancyuk.com/",
    theme: unifiedTheme,
  },
  cerobi: {
    navbar: cerobiNavbar,
    login: cerobiLogin,
    loading: cerobiLoading,
    name: "Cerobi Group Ltd",
    homepage: "https://cerobigroup-uk.com/",
    theme: unifiedTheme,
  },
  crs: {
    navbar: crsNavbar,
    login: crsLogin,
    loading: crsLoading,
    name: "CRS Group Holding Ltd",
    homepage: "https://crs-staffing.com/",
    theme: unifiedTheme,
  },
  orbit: {
    navbar: orbitNavbar,
    login: orbitLogin,
    loading: orbitLoading,
    name: "",
    homepage: "",
    theme: unifiedTheme,
  },
  tierone: {
    navbar: tierOneNavbar,
    login: tierOneLogin,
    loading: tierOneLoading,
    name: "Tier One Recruiting Ltd",
    homepage: "",
    theme: unifiedTheme,
  },
  mumentum: {
    navbar: mumentumNavbar,
    login: mumentumLogin,
    loading: mumentumLoading,
    name: "Mumentum Group Holding Ltd",
    homepage: "",
    theme: unifiedTheme,
  },
  was: {
    navbar: wasNavbar,
    login: wasLogin,
    loading: wasLoading,
    name: "Woodborough Admin Services Ltd",
    homepage: "",
    theme: unifiedTheme,
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
