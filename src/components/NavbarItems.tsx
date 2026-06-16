import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import { useData } from "../context/DataProvider";

type BadgeKey = "staff" | "invoices" | "timesheets";

const CLIENT_BADGE_MAP: Record<string, BadgeKey> = {
  STAFF: "staff",
  INVOICES: "invoices",
};

const ADMIN_BADGE_MAP: Record<string, BadgeKey> = {
  TIMESHEETS: "timesheets",
};

const ADMIN_ROUTES = [
  { label: "STAFF", to: "/staff" },
  { label: "CLIENTS", to: "/clients" },
  { label: "UPLOAD", to: "/upload" },
  { label: "INVOICES", to: "/invoices" },
  { label: "TIMESHEETS", to: "/timesheets" },
  { label: "USERS", to: "/admin" },
  { label: "PROFILE", to: "/profile" },
];

const CLIENT_ROUTES = [
  { label: "STAFF", to: "/staff" },
  { label: "UPLOAD", to: "/upload" },
  { label: "INVOICES", to: "/invoices" },
  { label: "TIMESHEETS", to: "/timesheets" },
  { label: "SUPPORT", to: "/support" },
  { label: "PROFILE", to: "/profile" },
];

function NavItem({
  label,
  to,
  count,
  className,
}: {
  label: string;
  to: string;
  count: number;
  className: (props: { isActive: boolean }) => string;
}) {
  return (
    <span className="relative">
      <NavLink to={to} className={className} end>
        {label}
      </NavLink>
      {count > 0 && (
        <span className="absolute right-0 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-yellow-300 bg-yellow-100 text-[10px] font-bold text-yellow-700">
          {count}
        </span>
      )}
    </span>
  );
}

export function NavbarItems({
  className,
}: {
  className: (props: { isActive: boolean }) => string;
}) {
  const { appUser } = useAuth();
  const { counts } = useData();
  const isAdmin = appUser?.role === "admin";

  const routes = isAdmin ? ADMIN_ROUTES : CLIENT_ROUTES;
  const badgeMap = isAdmin ? ADMIN_BADGE_MAP : CLIENT_BADGE_MAP;

  return routes.map((route) => (
    <NavItem
      key={route.to}
      label={route.label}
      to={route.to}
      count={badgeMap[route.label] != null ? counts[badgeMap[route.label]] : 0}
      className={className}
    />
  ));
}
