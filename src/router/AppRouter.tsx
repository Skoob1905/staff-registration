import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import { AppLayout } from "../layouts/AppLayout";
import { AdminLayout } from "../layouts/AdminLayout";
import { ClientLayout } from "../layouts/ClientLayout";
import { LoginPage } from "../pages/LoginPage";
import { AdminPage } from "../pages/admin/AdminPage";
import { AdminClientsPage } from "../pages/admin/ClientsPage";
import { AdminStaffPage } from "../pages/admin/StaffPage";
import { UserHomePage } from "../pages/clients/HomePage";
import { ProfilePage } from "../pages/clients/ProfilePage";
import { RoleGuard } from "./RoleGuard";

const AppEntryRedirect = () => {
  const { appUser } = useAuth();
  if (!appUser) return <Navigate to="/login" replace />;
  return (
    <Navigate to={appUser.role === "admin" ? "/staff" : "/home"} replace />
  );
};

const LoginRedirect = () => {
  const { firebaseUser, appUser, loading } = useAuth();
  if (loading) return <div className="p-6 text-sm">Loading...</div>;
  if (firebaseUser && appUser)
    return (
      <Navigate to={appUser.role === "admin" ? "/staff" : "/home"} replace />
    );
  return <LoginPage />;
};

const StaffPageSwitch = () => {
  const { appUser } = useAuth();
  if (!appUser) return <Navigate to="/login" replace />;
  if (appUser.role === "admin") return <AdminStaffPage />;
  return <UserHomePage />;
};

const ProfileSwitch = () => {
  const { appUser } = useAuth();
  if (!appUser) return <Navigate to="/login" replace />;
  return <ProfilePage />;
};

export const AppRouter = () => (
  <Routes>
    <Route path="/login" element={<LoginRedirect />} />

    <Route element={<RoleGuard role="authenticated" />}>
      <Route element={<AppLayout />}>
        <Route path="/profile" element={<ProfileSwitch />} />

        <Route element={<RoleGuard role="admin" />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/clients" element={<AdminClientsPage />} />
            {/* <Route path="/upload" element={<AdminUploadPage />} /> */}
            <Route path="/staff" element={<StaffPageSwitch />} />
          </Route>
        </Route>

        <Route element={<RoleGuard role="client" />}>
          <Route element={<ClientLayout />}>
            <Route path="/home" element={<StaffPageSwitch />} />
          </Route>
        </Route>

        <Route path="/" element={<AppEntryRedirect />} />
        <Route path="*" element={<AppEntryRedirect />} />
      </Route>
    </Route>
  </Routes>
);
