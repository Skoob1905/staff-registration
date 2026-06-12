import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import { AppLayout } from "../layouts/AppLayout";
import { AdminLayout } from "../layouts/AdminLayout";
import { LoadingPage } from "../components/LoadingPage";
import { LoginPage } from "../pages/LoginPage";
import { AdminPage } from "../pages/admin/AdminPage";
import { AdminClientsPage } from "../pages/admin/ClientsPage";
import { AdminTimesheetsPage } from "../pages/admin/TimesheetsPage";
import { AdminInvoicesPage } from "../pages/admin/InvoicesPage";
import { AdminStaffPage } from "../pages/admin/StaffPage";
import { UserHomePage } from "../pages/clients/HomePage";
import { InvoicesPage } from "../pages/clients/InvoicesPage";
import { ProfilePage } from "../pages/clients/ProfilePage";
import { SupportPage } from "../pages/clients/SupportPage";
import { UploadPage } from "../pages/Upload";
import { RoleGuard } from "./RoleGuard";

const AppEntryRedirect = () => {
  const { appUser } = useAuth();
  if (!appUser) return <Navigate to="/login" replace />;
  return <Navigate to="/staff" replace />;
};

const LoginRedirect = () => {
  const { firebaseUser, appUser, loading } = useAuth();
  if (loading) return <LoadingPage />;
  if (firebaseUser && appUser) return <Navigate to="/staff" replace />;
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

const InvoicesSwitch = () => {
  const { appUser } = useAuth();
  if (!appUser) return <Navigate to="/login" replace />;
  if (appUser.role === "admin") return <AdminInvoicesPage />;
  return <InvoicesPage />;
};

export const AppRouter = () => (
  <>
    <Routes>
      <Route path="/login" element={<LoginRedirect />} />

      <Route element={<RoleGuard role="authenticated" />}>
        <Route element={<AppLayout />}>
          <Route path="/staff" element={<StaffPageSwitch />} />
          <Route path="/profile" element={<ProfileSwitch />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/invoices" element={<InvoicesSwitch />} />
          <Route path="/support" element={<SupportPage />} />

          <Route element={<RoleGuard role="admin" />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/clients" element={<AdminClientsPage />} />
              <Route path="/timesheets" element={<AdminTimesheetsPage />} />
            </Route>
          </Route>

          <Route path="/" element={<AppEntryRedirect />} />
          <Route path="*" element={<AppEntryRedirect />} />
        </Route>
      </Route>
    </Routes>
  </>
);
