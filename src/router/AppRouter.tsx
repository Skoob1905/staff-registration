import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import { AppLayout } from "../layouts/AppLayout";
import { LoadingPage } from "../components/LoadingPage";
import { Login } from "../pages/Login";
import { ResetPassword } from "../pages/ResetPassword";
import { ForgotPassword } from "../pages/ForgotPassword";
import { Agencies } from "../pages/Agencies";
import { ClientAgencies } from "../pages/ClientAgencies";
import { Clients } from "../pages/Clients";
import { AllTimesheets } from "../pages/AllTimesheets";
import { Payslips } from "../pages/Payslips";
import { AllInvoices } from "../pages/AllInvoices";
import { Staff } from "../pages/Staff";
import { Home } from "../pages/Home";
import { Invoices } from "../pages/Invoices";
import { Profile } from "../pages/Profile";
import { Support } from "../pages/Support";
import { Timesheets } from "../pages/Timesheets";
import { Upload } from "../pages/Upload";
import { Dashboard } from "../pages/Dashboard";
import { RoleGuard } from "./RoleGuard";

const AppEntryRedirect = () => {
  const { appUser } = useAuth();
  if (!appUser) return <Navigate to="/login" replace />;
  if (appUser.role === "worker") return <Navigate to="/dashboard" replace />;
  if (appUser.role === "admin") return <Navigate to="/agencies" replace />;
  if (appUser.role === "super") return <Navigate to="/clients" replace />;
  return <Navigate to="/staff" replace />;
};

const LoginRedirect = () => {
  const { firebaseUser, appUser, loading } = useAuth();
  if (loading) return <LoadingPage />;
  if (firebaseUser && appUser) {
    if (appUser.role === "admin") return <Navigate to="/agencies" replace />;
    if (appUser.role === "super") return <Navigate to="/clients" replace />;
    return <Navigate to="/staff" replace />;
  }
  return <Login />;
};

const StaffPageSwitch = () => {
  const { appUser } = useAuth();
  if (!appUser) return <Navigate to="/login" replace />;
  if (appUser.role === "worker") return <Navigate to="/dashboard" replace />;
  if (appUser.role === "super") return <Staff />;
  return <Home />;
};

const ProfileSwitch = () => {
  const { appUser } = useAuth();
  if (!appUser) return <Navigate to="/login" replace />;
  return <Profile />;
};

const DashboardSwitch = () => {
  const { appUser } = useAuth();
  if (!appUser) return <Navigate to="/login" replace />;
  if (appUser.role !== "worker") return <Navigate to="/staff" replace />;
  return <Dashboard />;
};

const InvoicesSwitch = () => {
  const { appUser } = useAuth();
  if (!appUser) return <Navigate to="/login" replace />;
  if (appUser.role === "super") return <AllInvoices />;
  return <Invoices />;
};

const TimesheetsSwitch = () => {
  const { appUser } = useAuth();
  if (!appUser) return <Navigate to="/login" replace />;
  if (appUser.role === "super") return <AllTimesheets />;
  return <Timesheets />;
};

const PayslipsSwitch = () => {
  const { appUser } = useAuth();
  if (!appUser) return <Navigate to="/login" replace />;
  if (appUser.role === "super" || appUser.role === "admin" || appUser.role === "client") return <Payslips />;
  return <Navigate to="/staff" replace />;
};

const AgenciesSwitch = () => {
  const { appUser } = useAuth();
  if (!appUser) return <Navigate to="/login" replace />;
  if (appUser.role === "super") return <Agencies />;
  return <ClientAgencies />;
};

export const AppRouter = () => (
  <>
    <Routes>
      <Route path="/login" element={<LoginRedirect />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      <Route element={<RoleGuard role="authenticated" />}>
        <Route element={<AppLayout />}>
          <Route path="/staff" element={<StaffPageSwitch />} />
          <Route path="/profile" element={<ProfileSwitch />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/invoices" element={<InvoicesSwitch />} />
          <Route path="/timesheets" element={<TimesheetsSwitch />} />
          <Route path="/payslips" element={<PayslipsSwitch />} />
          <Route path="/support" element={<Support />} />
          <Route path="/dashboard" element={<DashboardSwitch />} />

          <Route element={<RoleGuard role="super" />}>
            <Route path="/clients" element={<Clients />} />
          </Route>

          <Route path="/agencies" element={<AgenciesSwitch />} />

          <Route path="/" element={<AppEntryRedirect />} />
          <Route path="*" element={<AppEntryRedirect />} />
        </Route>
      </Route>
    </Routes>
  </>
);
