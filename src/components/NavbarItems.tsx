import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import { useData } from "../context/DataProvider";

type BadgeKey = "staff" | "invoices" | "timesheets";

const SUPER_BADGE_MAP: Record<string, BadgeKey> = {
  TIMESHEETS: "timesheets",
};

const ADMIN_BADGE_MAP: Record<string, BadgeKey> = {
  INVOICES: "invoices",
};

const CLIENT_BADGE_MAP: Record<string, BadgeKey> = {
  STAFF: "staff",
};

const SUPER_ROUTES = [
  { label: "CLIENTS", to: "/clients" },
  { label: "AGENCIES", to: "/agencies" },
  { label: "STAFF", to: "/staff" },
  { label: "UPLOAD", to: "/upload" },
  { label: "INVOICES", to: "/invoices" },
  { label: "PROFILE", to: "/profile" },
];

const ADMIN_ROUTES = [
  { label: "AGENCIES", to: "/agencies" },
  { label: "STAFF", to: "/staff" },
  { label: "INVOICES", to: "/invoices" },
  // hide for the tiem being
  // { label: "TIMESHEETS", to: "/timesheets" },
  { label: "PROFILE", to: "/profile" },
  { label: "SUPPORT", to: "/support" },
];

const CLIENT_ROUTES = [
  { label: "STAFF", to: "/staff" },
  // hide for the tiem being
  // { label: "UPLOAD", to: "/upload" },
  { label: "TIMESHEETS", to: "/timesheets" },
  { label: "PROFILE", to: "/profile" },
  { label: "SUPPORT", to: "/support" },
];

const WORKER_ROUTES = [
  { label: "DASHBOARD", to: "/dashboard" },
  { label: "PROFILE", to: "/profile" },
  { label: "SUPPORT", to: "/support" },
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
  const role = appUser?.role;

  const routes =
    role === "super"
      ? SUPER_ROUTES
      : role === "admin"
        ? ADMIN_ROUTES
        : role === "worker"
          ? WORKER_ROUTES
          : CLIENT_ROUTES;

  const badgeMap =
    role === "super"
      ? SUPER_BADGE_MAP
      : role === "admin"
        ? ADMIN_BADGE_MAP
        : role === "client"
          ? CLIENT_BADGE_MAP
          : {};

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
