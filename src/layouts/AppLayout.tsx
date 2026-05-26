import logo from "../assets/BlackRock.jpg";
import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { logoutUser } from "../services/authService";
import { useAuth } from "../context/AuthProvider";
import { Button } from "../components/ui";
import { Footer } from "../components/Footer";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center h-8 rounded-xl px-3 text-xs font-semibold transition sm:px-4 sm:text-sm ${
    isActive
      ? "bg-[var(--primary)] text-white"
      : "text-[var(--muted-foreground)] hover:bg-[color:rgba(0,95,87,0.08)] hover:text-[var(--foreground)]"
  }`;

export const AppLayout = () => {
  const { appUser } = useAuth();
  const [, setTheme] = useState<"light" | "dark">("light");

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

  const isAdmin = appUser?.role === "admin";

  const navLinks = isAdmin ? (
    <>
      <NavLink to="/staff" className={navLinkClass} end>
        STAFF
      </NavLink>
      <NavLink to="/clients" className={navLinkClass}>
        CLIENTS
      </NavLink>
      <NavLink to="/admin" className={navLinkClass}>
        USERS
      </NavLink>
      <NavLink to="/profile" className={navLinkClass}>
        PROFILE
      </NavLink>
    </>
  ) : (
    <>
      <NavLink to="/staff" className={navLinkClass} end>
        STAFF
      </NavLink>
      <NavLink to="/profile" className={navLinkClass}>
        PROFILE
      </NavLink>
    </>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header
        className="sticky top-0 z-20 border-b border-[var(--border)] backdrop-blur"
        style={{ backgroundColor: "var(--header-bg)" }}
      >
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex flex-wrap items-center sm:grid sm:grid-cols-[1fr_auto_1fr]">
            <img
              src={logo}
              alt="HandySign"
              className="max-h-5 w-auto shrink-0 object-contain sm:justify-self-start sm:max-h-6 md:max-h-7"
            />
            <nav className="order-last flex basis-full justify-center gap-2 pt-2 sm:order-none sm:basis-auto sm:pt-0">
              {navLinks}
            </nav>
            <div className="ml-auto flex items-center gap-2 sm:justify-self-end sm:ml-0">
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

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-3 sm:py-6">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
};
