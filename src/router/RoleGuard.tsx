import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import type { UserRole } from "../types/domain";

export const RoleGuard = ({ role }: { role: UserRole }) => {
  const { appUser, loading } = useAuth();

  if (loading) return <div className="p-6 text-sm">Checking permissions...</div>;
  if (!appUser) return <Navigate to="/login" replace />;
  if (appUser.role !== role) {
    return <Navigate to={appUser.role === "admin" ? "/app/admin/staff" : "/app/user/home"} replace />;
  }
  return <Outlet />;
};
