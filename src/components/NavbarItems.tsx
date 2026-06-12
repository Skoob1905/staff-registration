import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";

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

export function NavbarItems({ className }) {
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === "admin";

  const AdminItems = ADMIN_ROUTES.map((route) => (
    <NavLink to={route.to} className={className} end>
      {route.label}
    </NavLink>
  ));

  const ClientItems = CLIENT_ROUTES.map((route) => (
    <NavLink to={route.to} className={className} end>
      {route.label}
    </NavLink>
  ));

  return isAdmin ? AdminItems : ClientItems;
}
