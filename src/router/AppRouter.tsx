import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import { AppLayout } from "../layouts/AppLayout";
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
import { TimeSheetsPage } from "../pages/clients/TimeSheetsPage";
import { UploadPage } from "../pages/Upload";
import { DashboardPage } from "../pages/worker/DashboardPage";
import { RoleGuard } from "./RoleGuard";

const AppEntryRedirect = () => {
  const { appUser } = useAuth();
  if (!appUser) return <Navigate to="/login" replace />;
  if (appUser.role === "worker") return <Navigate to="/dashboard" replace />;
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
  if (appUser.role === "worker") return <Navigate to="/dashboard" replace />;
  if (appUser.role === "super" || appUser.role === "admin")
    return <AdminStaffPage />;
  return <UserHomePage />;
};

const ProfileSwitch = () => {
  const { appUser } = useAuth();
  if (!appUser) return <Navigate to="/login" replace />;
  return <ProfilePage />;
};

const DashboardSwitch = () => {
  const { appUser } = useAuth();
  if (!appUser) return <Navigate to="/login" replace />;
  if (appUser.role !== "worker") return <Navigate to="/staff" replace />;
  return <DashboardPage />;
};

const InvoicesSwitch = () => {
  const { appUser } = useAuth();
  if (!appUser) return <Navigate to="/login" replace />;
  if (appUser.role === "super") return <AdminInvoicesPage />;
  return <InvoicesPage />;
};

const TimesheetsSwitch = () => {
  const { appUser } = useAuth();
  if (!appUser) return <Navigate to="/login" replace />;
  if (appUser.role === "super") return <AdminTimesheetsPage />;
  return <TimeSheetsPage />;
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
          <Route path="/timesheets" element={<TimesheetsSwitch />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="/dashboard" element={<DashboardSwitch />} />

          <Route element={<RoleGuard role="super" />}>
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/agencies" element={<AdminClientsPage />} />
          </Route>

          <Route path="/" element={<AppEntryRedirect />} />
          <Route path="*" element={<AppEntryRedirect />} />
        </Route>
      </Route>
    </Routes>
  </>
);
