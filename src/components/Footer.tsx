import { NavLink, useLocation } from "react-router-dom";

declare const __APP_VERSION__: string;

const ADMIN_ROUTES = [
  { label: "STAFF", to: "/staff" },
  { label: "CLIENTS", to: "/clients" },
  { label: "UPLOAD", to: "/upload" },
  { label: "INVOICES", to: "/invoices" },
  { label: "USERS", to: "/admin" },
  { label: "PROFILE", to: "/profile" },
];

const CLIENT_ROUTES = [
  { label: "STAFF", to: "/staff" },
  { label: "UPLOAD", to: "/upload" },
  { label: "INVOICES", to: "/invoices" },
  { label: "SUPPORT", to: "/support" },
  { label: "PROFILE", to: "/profile" },
];

const ADMIN_PATHS = ["/admin", "/clients", "/timesheets"];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `text-[11px] transition hover:text-[var(--primary)] ${
    isActive
      ? "text-[var(--primary)] font-semibold"
      : "text-[var(--muted-foreground)]"
  }`;

export const Footer = () => {
  const { pathname } = useLocation();
  const isAdminPage = ADMIN_PATHS.some((prefix) => pathname.startsWith(prefix));
  const routes = isAdminPage ? ADMIN_ROUTES : CLIENT_ROUTES;

  return (
    <footer
      className="border-t py-3"
      style={{
        backgroundColor: "var(--header-bg)",
        borderColor: "transparent",
        borderImage: "linear-gradient(90deg, #99f6e4, #93c5fd, #99f6e4) 1",
      }}
    >
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            {routes.map((route) => (
              <NavLink
                key={route.to}
                to={route.to}
                className={navLinkClass}
                end
              >
                {route.label}
              </NavLink>
            ))}

            <span className="text-[11px] text-[var(--muted-foreground)]">
              v{__APP_VERSION__}
            </span>
          </div>
      </div>
      <div
        className="mx-auto mt-3 max-w-6xl border-t px-4 pt-3 text-center text-[11px] text-[var(--muted-foreground)]"
        style={{
          borderColor: "transparent",
          borderImage: "linear-gradient(90deg, #99f6e4, #93c5fd, #99f6e4) 1",
        }}
      >
        Designed &amp; Created by Ruby Digital Services
      </div>
    </footer>
  );
};
