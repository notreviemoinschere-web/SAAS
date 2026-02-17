import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider, useAuth } from "@/lib/auth";
import CookieBanner from "@/components/CookieBanner";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import VerifyEmail from "@/pages/VerifyEmail";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import AdminDashboard from "@/pages/AdminDashboard";
import TenantDashboard from "@/pages/TenantDashboard";
import CampaignEditor from "@/pages/CampaignEditor";
import PlayGame from "@/pages/PlayGame";
import StaffRedeem from "@/pages/StaffRedeem";
import Billing from "@/pages/Billing";

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={user ? <Navigate to={user.role === "super_admin" ? "/admin" : "/dashboard"} /> : <Login />} />
      <Route path="/signup" element={user ? <Navigate to="/dashboard" /> : <Signup />} />
      <Route path="/verify-email" element={<VerifyEmail />} />

      {/* Admin */}
      <Route path="/admin" element={<ProtectedRoute roles={["super_admin"]}><AdminDashboard /></ProtectedRoute>} />

      {/* Tenant */}
      <Route path="/dashboard" element={<ProtectedRoute roles={["tenant_owner", "tenant_staff", "super_admin"]}><TenantDashboard /></ProtectedRoute>} />
      <Route path="/dashboard/campaigns/new" element={<ProtectedRoute roles={["tenant_owner", "super_admin"]}><CampaignEditor /></ProtectedRoute>} />
      <Route path="/dashboard/campaigns/:id" element={<ProtectedRoute roles={["tenant_owner", "super_admin"]}><CampaignEditor /></ProtectedRoute>} />
      <Route path="/dashboard/redeem" element={<ProtectedRoute roles={["tenant_owner", "tenant_staff", "super_admin"]}><StaffRedeem /></ProtectedRoute>} />
      <Route path="/dashboard/billing" element={<ProtectedRoute roles={["tenant_owner", "super_admin"]}><Billing /></ProtectedRoute>} />

      {/* Public Game */}
      <Route path="/play/:slug" element={<PlayGame />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <CookieBanner />
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  );
}

export default App;
