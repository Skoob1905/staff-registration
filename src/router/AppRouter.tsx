import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import { AppLayout } from "../layouts/AppLayout";
import { AdminLayout } from "../layouts/AdminLayout";
import { UserLayout } from "../layouts/UserLayout";
import { LoginPage } from "../pages/LoginPage";
import { AdminStaffPage } from "../pages/admin/AdminStaffPage";
import { AdminUploadPage } from "../pages/admin/AdminUploadPage";
import { UserHomePage } from "../pages/user/UserHomePage";
import { UserUploadPage } from "../pages/user/UserUploadPage";
import { AuthGuard } from "./AuthGuard";
import { RoleGuard } from "./RoleGuard";

const AppEntryRedirect = () => {
  const { appUser } = useAuth();
  if (!appUser) return <Navigate to="/login" replace />;
  return <Navigate to={appUser.role === "admin" ? "/app/admin/staff" : "/app/user/home"} replace />;
};

const LoginRedirect = () => {
  const { firebaseUser, appUser, loading } = useAuth();
  if (loading) return <div className="p-6 text-sm">Loading...</div>;
  if (firebaseUser && appUser) return <Navigate to={appUser.role === "admin" ? "/app/admin/staff" : "/app/user/home"} replace />;
  return <LoginPage />;
};

export const AppRouter = () => (
  <Routes>
    <Route path="/login" element={<LoginRedirect />} />

    <Route element={<AuthGuard />}>
      <Route element={<AppLayout />}>
        <Route path="/app" element={<AppEntryRedirect />} />

        <Route element={<RoleGuard role="admin" />}>
          <Route element={<AdminLayout />}>
            <Route path="/app/admin" element={<Navigate to="/app/admin/staff" replace />} />
            <Route path="/app/admin/staff" element={<AdminStaffPage />} />
            <Route path="/app/admin/upload" element={<AdminUploadPage />} />
          </Route>
        </Route>

        <Route element={<RoleGuard role="user" />}>
          <Route element={<UserLayout />}>
            <Route path="/app/user/home" element={<UserHomePage />} />
            <Route path="/app/user/upload" element={<UserUploadPage />} />
          </Route>
        </Route>
      </Route>
    </Route>

    <Route path="*" element={<AppEntryRedirect />} />
  </Routes>
);
