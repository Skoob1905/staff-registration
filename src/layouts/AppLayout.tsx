import { X, Menu, Moon, Sun } from "lucide-react";
import logo from "../assets/edited-photo.png";
import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { logoutUser } from "../services/authService";
import { useAuth } from "../context/AuthProvider";
import { Button } from "../components/ui";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-xl px-2 py-1 text-xs font-semibold transition sm:px-4 sm:py-2 sm:text-sm ${
    isActive
      ? "bg-[var(--primary)] text-white"
      : "text-[var(--muted-foreground)] hover:bg-[color:rgba(31,79,138,0.08)] hover:text-[var(--foreground)]"
  }`;

const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block w-full rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
    isActive
      ? "bg-[var(--primary)] text-white"
      : "text-[var(--muted-foreground)] hover:bg-[color:rgba(31,79,138,0.08)] hover:text-[var(--foreground)]"
  }`;

export const AppLayout = () => {
  const { appUser } = useAuth();
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const prefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const nextTheme =
      stored === "dark" || stored === "light"
        ? (stored as "light" | "dark")
        : prefersDark
          ? "dark"
          : "light";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  };

  const isAdmin = appUser?.role === "admin";

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    if (mobileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mobileMenuOpen]);

  const mobileNavLinks = isAdmin ? (
    <>
      <NavLink
        to="/staff"
        className={mobileNavLinkClass}
        end
        onClick={() => setMobileMenuOpen(false)}
      >
        STAFF
      </NavLink>
      <NavLink
        to="/clients"
        className={mobileNavLinkClass}
        onClick={() => setMobileMenuOpen(false)}
      >
        CLIENTS
      </NavLink>
      <NavLink
        to="/admin"
        className={mobileNavLinkClass}
        onClick={() => setMobileMenuOpen(false)}
      >
        USERS
      </NavLink>
      <NavLink
        to="/profile"
        className={mobileNavLinkClass}
        onClick={() => setMobileMenuOpen(false)}
      >
        PROFILE
      </NavLink>
    </>
  ) : (
    <>
      <NavLink
        to="/home"
        className={mobileNavLinkClass}
        end
        onClick={() => setMobileMenuOpen(false)}
      >
        HOME
      </NavLink>
      <NavLink
        to="/profile"
        className={mobileNavLinkClass}
        onClick={() => setMobileMenuOpen(false)}
      >
        PROFILE
      </NavLink>
    </>
  );

  const navLinks = isAdmin ? (
    <>
      <NavLink
        to="/staff"
        className={navLinkClass}
        end
        onClick={() => setMobileMenuOpen(false)}
      >
        STAFF
      </NavLink>
      <NavLink
        to="/clients"
        className={navLinkClass}
        onClick={() => setMobileMenuOpen(false)}
      >
        CLIENTS
      </NavLink>
      <NavLink
        to="/admin"
        className={navLinkClass}
        onClick={() => setMobileMenuOpen(false)}
      >
        USERS
      </NavLink>
      <NavLink
        to="/profile"
        className={navLinkClass}
        onClick={() => setMobileMenuOpen(false)}
      >
        PROFILE
      </NavLink>
    </>
  ) : (
    <>
      <NavLink
        to="/home"
        className={navLinkClass}
        end
        onClick={() => setMobileMenuOpen(false)}
      >
        HOME
      </NavLink>
      <NavLink
        to="/profile"
        className={navLinkClass}
        onClick={() => setMobileMenuOpen(false)}
      >
        PROFILE
      </NavLink>
    </>
  );

  return (
    <div className="min-h-screen">
      <header
        className="sticky top-0 z-20 border-b border-[var(--border)] backdrop-blur relative"
        style={{ backgroundColor: "var(--header-bg)" }}
      >
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="relative flex items-center sm:flex-nowrap sm:gap-x-6">
            <div className="flex flex-1 items-center justify-start sm:hidden">
              <div className="relative sm:hidden">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen((prev) => !prev)}
                  aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                  className={mobileMenuOpen ? 'rounded-lg rounded-br-none rounded-bl-none border border-[var(--border)] bg-[var(--background)] p-1' : 'p-1'}
                >
                  {mobileMenuOpen ? (
                    <X className="h-5 w-5 text-[var(--foreground)]" />
                  ) : (
                    <Menu className="h-5 w-5 text-[var(--foreground)]" />
                  )}
                </button>

                {mobileMenuOpen && (
                  <div
                    ref={menuRef}
                    className="absolute top-full z-30 -mt-1 w-40 rounded-lg rounded-tl-none border border-[var(--border)] bg-[var(--background)] py-1 shadow-lg backdrop-blur-none animate-dropdown-enter"
                  >
                    <div className="flex flex-col gap-0.5 px-1.5 py-1.5">
                      {mobileNavLinks}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-1 items-center justify-center text-[var(--foreground)] sm:order-1 sm:flex-1 sm:justify-start">
              <img
                src={logo}
                alt="HandySign"
                className="max-h-5 w-auto shrink-0 object-contain sm:max-h-6 md:max-h-7"
              />
            </div>
            <div className="flex flex-1 items-center justify-end gap-2 sm:order-3 sm:flex-1 sm:justify-end">
              <Button
                type="button"
                className="rounded-lg"
                onClick={toggleTheme}
              >
                {theme === "light" ? (
                  <Moon className="h-4 w-4" />
                ) : (
                  <Sun className="h-4 w-4" />
                )}
              </Button>
              <Button
                type="button"
                className="rounded-lg"
                onClick={() => void logoutUser()}
              >
                Logout
              </Button>
            </div>
            <nav className="hidden sm:order-2 sm:block sm:w-auto">
              <div className="flex justify-center gap-2">{navLinks}</div>
            </nav>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-3 sm:py-6">
        <Outlet />
      </main>
    </div>
  );
};
