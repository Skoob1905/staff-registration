import { Home, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { logoutUser } from "../services/authService";
import { useAuth } from "../context/AuthProvider";
import { Button } from "../components/ui";

export const AppLayout = () => {
  const { agency } = useAuth();
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

  return (
    <div className="min-h-screen">
      <header
        className="sticky top-0 z-20 border-b border-[var(--border)] backdrop-blur"
        style={{ backgroundColor: "var(--header-bg)" }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 text-[var(--foreground)]">
            <Home className="h-5 w-5 text-[var(--muted-foreground)]" />
            <span className="text-sm font-bold">HandySign</span>
          </div>
          <div className="text-sm text-[var(--muted-foreground)]">{agency?.name ?? "Agency"}</div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              className="rounded-lg"
              onClick={toggleTheme}
            >
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
            <Button type="button" className="rounded-lg" onClick={() => void logoutUser()}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
};
