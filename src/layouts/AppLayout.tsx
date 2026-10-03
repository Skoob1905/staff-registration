import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { SecondaryNavbar } from "./SecondaryNavbar";
import { GlobalBanner } from "./GlobalBanner";
import { ProfileDropdown } from "./ProfileDropdown";
import { useAuth } from "../context/AuthProvider";
import { Navbar } from "./Navbar/Navbar";

export const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { appUser } = useAuth();
  const { pathname } = useLocation();

  const showSecondaryNavbar =
    appUser?.role === "super" &&
    ["/staff", "/agencies", "/clients"].includes(pathname);

  return (
    <div className="flex h-dvh flex-col overflow-hidden app-bg">
      <GlobalBanner />

      <div className="flex flex-1 min-h-0 gap-1 p-1.5">
        <Navbar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1">
          <header className="grid h-[72px] shrink-0 grid-cols-[1fr_auto_1fr] items-center rounded-xl border border-[var(--border)] bg-[var(--header-bg)] px-4 sm:px-6">
            <div className="flex items-center">
              <button
                onClick={() => setSidebarOpen(true)}
                className="rounded-md p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)] md:hidden"
              >
                <Menu className="size-5" />
              </button>
            </div>

            <div className="flex items-center justify-center">
              {showSecondaryNavbar && <SecondaryNavbar />}
            </div>

            <div className="flex items-center justify-end">
              <ProfileDropdown />
            </div>
          </header>

          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--header-bg)] px-2 py-2 sm:py-4">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};
