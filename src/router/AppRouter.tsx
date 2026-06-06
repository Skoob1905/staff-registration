import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import { AppLayout } from "../layouts/AppLayout";
import { AdminLayout } from "../layouts/AdminLayout";
import { LoadingPage } from "../components/LoadingPage";
import { LoginPage } from "../pages/LoginPage";
import { AdminPage } from "../pages/admin/AdminPage";
import { AdminClientsPage } from "../pages/admin/ClientsPage";
import { AdminStaffPage } from "../pages/admin/StaffPage";
import { UserHomePage } from "../pages/clients/HomePage";
// import { TimeSheetsPage } from "../pages/clients/TimeSheetsPage";
// import { PayslipsPage } from "../pages/clients/PayslipsPage";
// import { ContractsPage } from "../pages/clients/ContractsPage";
// import { InvoicesPage } from "../pages/clients/InvoicesPage";
import { ProfilePage } from "../pages/clients/ProfilePage";
import { UploadPage } from "../pages/Upload";
import { RoleGuard } from "./RoleGuard";

const AppEntryRedirect = () => {
  const { appUser } = useAuth();
  if (!appUser) return <Navigate to="/login" replace />;
  return (
    <Navigate to="/staff" replace />
  );
};

const LoginRedirect = () => {
  const { firebaseUser, appUser, loading } = useAuth();
  if (loading) return <LoadingPage />;
  if (firebaseUser && appUser)
    return (
      <Navigate to="/staff" replace />
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
  <>
    <Routes>
      <Route path="/login" element={<LoginRedirect />} />

      <Route element={<RoleGuard role="authenticated" />}>
        <Route element={<AppLayout />}>
          <Route path="/staff" element={<StaffPageSwitch />} />
          <Route path="/profile" element={<ProfileSwitch />} />
          <Route path="/upload" element={<UploadPage />} />

          <Route element={<RoleGuard role="admin" />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/clients" element={<AdminClientsPage />} />
              {/* <Route path="/timesheets" element={<TimeSheetsPage />} /> */}
              {/* <Route path="/payslips" element={<PayslipsPage />} /> */}
              {/* <Route path="/contracts" element={<ContractsPage />} /> */}
              {/* <Route path="/invoices" element={<InvoicesPage />} /> */}
            </Route>
          </Route>

          <Route path="/" element={<AppEntryRedirect />} />
          <Route path="*" element={<AppEntryRedirect />} />
        </Route>
      </Route>
    </Routes>
  </>
);
