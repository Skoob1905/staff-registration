import { NavLink, Outlet } from "react-router-dom";

export const AdminLayout = () => (
  <div className="space-y-4">
    <nav className="flex gap-2 rounded-2xl border border-[var(--border)] bg-white p-2">
      <NavLink to="/app/admin/staff" className={"tabClass"}>
        STAFF
      </NavLink>
      <NavLink to="/app/admin/upload" className={"tabClass"}>
        UPLOAD
      </NavLink>
    </nav>
    <Outlet />
  </div>
);
