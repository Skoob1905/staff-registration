import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Menu, UserCircle } from "lucide-react";
import { SecondaryNavbar } from "./SecondaryNavbar";
import { GlobalBanner } from "./GlobalBanner";
import { useAuth } from "../context/AuthProvider";
import { Navbar } from "./Navbar/Navbar";

export const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { appUser } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const initials =
    appUser?.firstName && appUser?.lastName
      ? `${appUser.firstName[0]}${appUser.lastName[0]}`.toUpperCase()
      : null;

  const showSecondaryNavbar =
    appUser?.role === "super" &&
    ["/staff", "/agencies", "/clients"].includes(pathname);

  return (
    <div className="flex min-h-screen app-bg">
      <Navbar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div
        className="flex min-h-screen flex-1 flex-col md:ml-56"
        style={{ backgroundColor: "var(--header-bg)" }}
      >
        <header
          className="grid h-[72px] grid-cols-[1fr_auto_1fr] items-center border-b px-4 sm:px-6"
          style={{
            backgroundColor: "var(--header-bg)",
            borderColor: "transparent",
            borderImage: "linear-gradient(90deg, #99f6e4, #93c5fd, #99f6e4) 1",
          }}
        >
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
            <button
              onClick={() => void navigate("/profile")}
              className="flex items-center gap-2 rounded-lg p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
            >
              {initials ? (
                <span className="flex size-8 items-center justify-center rounded-full bg-[var(--primary-100)] text-xs font-bold text-[var(--primary)]">
                  {initials}
                </span>
              ) : (
                <UserCircle className="size-8" />
              )}
            </button>
          </div>
        </header>

        <GlobalBanner />

        <main className="flex-1 px-4 py-3 sm:py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
