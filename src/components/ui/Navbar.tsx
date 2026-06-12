import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import { logoutUser } from "../../services/authService";
import { useAuth } from "../../context/AuthProvider";
import { GlobalBanner } from "../../layouts/GlobalBanner";
import { Button } from ".";
import { config } from "../../config";
import { NavbarItems } from "../NavbarItems";

/**
 * THEME SWITCHER LOGIC — uncomment to enable
 */
// import { config, getStoredTheme } from "../../config";
// import { ThemeToggle } from "./ThemeToggle";

export const Navbar = () => {
  return (
    <header
      className="sticky top-0 z-20 border-b backdrop-blur"
      style={{
        backgroundColor: "var(--header-bg)",
        borderColor: "transparent",
        borderImage: "linear-gradient(90deg, #99f6e4, #93c5fd, #99f6e4) 1",
      }}
    >
      <GlobalBanner />
      <div className="mx-auto max-w-6xl px-4 py-3">
        <div className="flex flex-wrap items-center justify-between md:grid md:grid-cols-[1fr_auto_1fr] md:gap-x-6">
          <a
            href={config.homepage}
            target="_blank"
            rel="noopener noreferrer"
            className="md:justify-self-start"
          >
            <img
              src={config.navbar}
              alt={config.name}
              className="max-h-5 w-auto shrink-0 object-contain md:max-h-6 lg:max-h-7"
            />
          </a>
          <nav className="order-last flex basis-full flex-wrap justify-center gap-1 pt-2 md:order-none md:basis-auto md:max-w-full md:pt-0 md:gap-2">
            <NavbarItems
              className={({ isActive }) =>
                `relative flex items-center h-8 rounded-xl px-3 text-[11px] font-semibold transition sm:px-4 sm:text-sm ${
                  isActive
                    ? "text-[var(--primary)]"
                    : "text-[var(--muted-foreground)] hover:text-[var(--primary)]"
                } after:absolute after:bottom-0 after:left-1/2 after:h-[2px] after:w-0 after:-translate-x-1/2 after:rounded-full after:bg-[var(--primary)] after:transition-all after:duration-200 hover:after:w-4/5`
              }
            />
          </nav>
          <div className="flex items-center gap-2 md:justify-self-end">
            <Button
              type="button"
              className="rounded-lg"
              onClick={() => void logoutUser()}
            >
              Logout
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};
