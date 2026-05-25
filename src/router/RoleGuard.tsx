import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import type { UserRole } from "../types/domain";

const Forbidden = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="text-center">
      <h1 className="text-6xl font-bold text-red-600">403</h1>
      <p className="mt-2 text-lg text-[var(--muted-foreground)]">Forbidden</p>
    </div>
  </div>
);

export const RoleGuard = ({ role }: { role: UserRole | "authenticated" }) => {
  const { appUser, loading } = useAuth();

  if (loading) return <div className="p-6 text-sm">Checking permissions...</div>;
  if (!appUser) return <Navigate to="/login" replace />;

  if (role === "authenticated") return <Outlet />;

  if (appUser.role !== role) {
    if (role === "admin") {
      return <Forbidden />;
    }
    return <Navigate to={appUser.role === "admin" ? "/staff" : "/home"} replace />;
  }

  return <Outlet />;
};
