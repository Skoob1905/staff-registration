import { Home } from "lucide-react";
import { Outlet } from "react-router-dom";
import { logoutUser } from "../services/authService";
import { useAuth } from "../context/AuthProvider";

export const AppLayout = () => {
  const { agency } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 text-zinc-900">
            <Home className="h-5 w-5 text-zinc-700" />
            <span className="text-sm font-bold">HandySign</span>
          </div>
          <div className="text-sm text-zinc-600">{agency?.name ?? "Agency"}</div>
          <button
            className="rounded-lg border border-[var(--border)] bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
            onClick={() => void logoutUser()}
          >
            Logout -&gt;
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
};
