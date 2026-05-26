declare const __APP_VERSION__: string;

import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `text-xs transition hover:text-[var(--primary)] ${
    isActive
      ? "text-[var(--primary)] font-semibold"
      : "text-[var(--muted-foreground)]"
  }`;

export const Footer = () => {
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === "admin";

  return (
    <footer
      className="border-t border-[var(--border)] py-3"
      style={{ backgroundColor: "var(--header-bg)" }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-6 px-0 sm:px-1">
        <nav className="flex items-center gap-4">
          <NavLink to="/staff" className={navLinkClass} end>
            STAFF
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

        <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
          <a
            href="https://blackrockconsultancyuk.com"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-[var(--primary)]"
          >
            Blackrock Consultancy UK
          </a>
          <span>v{__APP_VERSION__}</span>
        </div>
      </div>
      <div className="mx-auto mt-3 max-w-6xl border-t border-[var(--border)] px-0 pt-3 text-center text-[11px] text-[var(--muted-foreground)] sm:px-1">
        Designed &amp; Created by Ruby Digital Services
      </div>
    </footer>
  );
};
