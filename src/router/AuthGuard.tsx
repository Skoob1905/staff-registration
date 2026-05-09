import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";

export const AuthGuard = () => {
  const { firebaseUser, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="p-6 text-sm">Loading session...</div>;
  if (!firebaseUser) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
};
