import { NavLink, Outlet } from "react-router-dom";

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-semibold transition ${isActive ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"}`;

export const UserLayout = () => (
  <div className="space-y-4">
    <nav className="flex gap-2 rounded-2xl border border-[var(--border)] bg-white p-2">
      <NavLink to="/app/user/home" className={tabClass}>
        HOME
      </NavLink>
      <NavLink to="/app/user/upload" className={tabClass}>
        UPLOAD
      </NavLink>
    </nav>
    <Outlet />
  </div>
);
