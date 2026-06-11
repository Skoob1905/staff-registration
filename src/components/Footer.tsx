declare const __APP_VERSION__: string;

import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `text-[11px] transition hover:text-[var(--primary)] ${
    isActive
      ? "text-[var(--primary)] font-semibold"
      : "text-[var(--muted-foreground)]"
  }`;

export const Footer = () => {
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === "admin";

  return (
    <footer
      className="border-t border-[var(--accent-light)] py-3"
      style={{ backgroundColor: "var(--header-bg)" }}
    >
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:relative">
          <nav className="flex items-center gap-4">
            <NavLink to="/staff" className={navLinkClass} end>
              STAFF
            </NavLink>
            <NavLink to="/upload" className={navLinkClass}>
              UPLOAD
            </NavLink>
            {isAdmin && (
              <NavLink to="/clients" className={navLinkClass}>
                CLIENTS
              </NavLink>
            )}
            {isAdmin && (
              <NavLink to="/admin" className={navLinkClass}>
                USERS
              </NavLink>
            )}
            <NavLink to="/profile" className={navLinkClass}>
              PROFILE
            </NavLink>
          </nav>

          <div className="flex items-center gap-3 text-[11px] text-[var(--muted-foreground)] sm:absolute sm:right-0">
            <span>v{__APP_VERSION__}</span>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-3 max-w-6xl border-t border-[var(--accent-light)] px-4 pt-3 text-center text-[11px] text-[var(--muted-foreground)]">
        Designed &amp; Created by Ruby Digital Services
      </div>
    </footer>
  );
};
