import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import { logoutUser } from "../../services/authService";
import { useAuth } from "../../context/AuthProvider";
import { GlobalBanner } from "../../layouts/GlobalBanner";
import { Button } from ".";
import { config } from "../../config";

/**
 * THEME SWITCHER LOGIC — uncomment to enable
 */
// import { config, getStoredTheme } from "../../config";
// import { ThemeToggle } from "./ThemeToggle";

type LinkProps = {
  to: string;
  children: ReactNode;
  end?: boolean;
};

export const NavbarLink = ({ to, children, end }: LinkProps) => (
  <NavLink
    to={to}
    end={end}
    className={({ isActive }) =>
      `relative flex items-center h-8 rounded-xl px-3 text-xs font-semibold transition sm:px-4 sm:text-sm ${
        isActive ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"
      } after:absolute after:bottom-0 after:left-1/2 after:h-[2px] after:w-0 after:-translate-x-1/2 after:rounded-full after:bg-[var(--muted-foreground)] after:transition-all after:duration-200 hover:after:w-4/5`
    }
  >
    {children}
  </NavLink>
);

export const Navbar = () => {
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === "admin";

  const navLinks = isAdmin ? (
    <>
      <NavbarLink to="/staff" end>
        STAFF
      </NavbarLink>
      <NavbarLink to="/upload">UPLOAD</NavbarLink>
      <NavbarLink to="/clients">CLIENTS</NavbarLink>
      <NavbarLink to="/timesheets">TIMESHEETS</NavbarLink>
      <NavbarLink to="/admin">USERS</NavbarLink>
      <NavbarLink to="/profile">PROFILE</NavbarLink>
    </>
  ) : (
    <>
      <NavbarLink to="/staff" end>
        STAFF
      </NavbarLink>
      <NavbarLink to="/upload">UPLOAD</NavbarLink>
      <NavbarLink to="/profile">PROFILE</NavbarLink>
    </>
  );

  return (
    <header
      className="sticky top-0 z-20 border-b border-[var(--border)] backdrop-blur"
      style={{ backgroundColor: "var(--header-bg)" }}
    >
      <GlobalBanner />
      <div className="mx-auto max-w-6xl px-4 py-3">
        <div className="flex flex-wrap items-center justify-between sm:grid sm:grid-cols-[1fr_auto_1fr] sm:gap-x-6">
          <a
            href={config.homepage}
            target="_blank"
            rel="noopener noreferrer"
            className="sm:justify-self-start"
          >
            <img
              src={config.navbar}
              alt={config.name}
              className="max-h-5 w-auto shrink-0 object-contain sm:max-h-6 md:max-h-7"
            />
          </a>
          <nav className="order-last flex basis-full flex-wrap justify-center gap-1 pt-2 sm:order-none sm:basis-auto sm:max-w-full sm:pt-0 sm:gap-2">
            {navLinks}
          </nav>
          <div className="flex items-center gap-2 sm:justify-self-end">
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
