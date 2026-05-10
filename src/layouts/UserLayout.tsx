import { Outlet } from "react-router-dom";

export const UserLayout = () => (
  <div className="space-y-4">
    {/* <nav className="flex gap-2 rounded-2xl border border-[var(--border)] bg-white p-2">
      <NavLink to="/app/user/home" className={tabClass}>
        HOME
      </NavLink>
      <NavLink to="/app/user/upload" className={tabClass}>
        UPLOAD
      </NavLink>
    </nav> */}
    <Outlet />
  </div>
);
