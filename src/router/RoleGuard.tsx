import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import { LoadingPage } from "../components/LoadingPage";
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

  if (loading) return <LoadingPage />;
  if (!appUser) return <Navigate to="/login" replace />;

  if (role === "authenticated") return <Outlet />;

  if (appUser.role !== role) {
    if (role === "admin") {
      return <Forbidden />;
    }
    return <Navigate to="/staff" replace />;
  }

  return <Outlet />;
};
