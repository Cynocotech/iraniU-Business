import { Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "./layouts/MainLayout.jsx";
import DashboardShellLayout from "./layouts/DashboardShellLayout.jsx";
import AdminShellLayout from "./layouts/AdminShellLayout.jsx";
import HomePage from "./pages/HomePage.jsx";
import ListingsPage from "./pages/ListingsPage.jsx";
import BusinessPage from "./pages/BusinessPage.jsx";
import BusinessClaimedPage from "./pages/BusinessClaimedPage.jsx";
import MapPage from "./pages/MapPage.jsx";
import AdvertisePage from "./pages/AdvertisePage.jsx";
import ClaimPage from "./pages/ClaimPage.jsx";
import BusinessOnboardingPage from "./pages/BusinessOnboardingPage.jsx";
import ManagerSignupPage from "./pages/ManagerSignupPage.jsx";
import DashboardOverviewPage from "./pages/dashboard/DashboardOverviewPage.jsx";
import DashboardEditPage from "./pages/dashboard/DashboardEditPage.jsx";
import DashboardMediaPage from "./pages/dashboard/DashboardMediaPage.jsx";
import DashboardTwilioSettingsPage from "./pages/dashboard/DashboardTwilioSettingsPage.jsx";
import DashboardCallsPage from "./pages/dashboard/DashboardCallsPage.jsx";
import DashboardQrPage from "./pages/dashboard/DashboardQrPage.jsx";
import DashboardBiolinkPage from "./pages/dashboard/DashboardBiolinkPage.jsx";
import DashboardCareersPage from "./pages/dashboard/DashboardCareersPage.jsx";
import BiolinkPublicPage from "./pages/BiolinkPublicPage.jsx";
import AdminHomePage from "./pages/admin/AdminHomePage.jsx";
import AdminBusinessesPage from "./pages/admin/AdminBusinessesPage.jsx";
import AdminEditBusinessPage from "./pages/admin/AdminEditBusinessPage.jsx";
import AdminAddBusinessPage from "./pages/admin/AdminAddBusinessPage.jsx";
import AdminCategoriesPage from "./pages/admin/AdminCategoriesPage.jsx";
import AdminQrExportPage from "./pages/admin/AdminQrExportPage.jsx";
import AdminClaimsPage from "./pages/admin/AdminClaimsPage.jsx";
import AdminLinkPage from "./pages/admin/AdminLinkPage.jsx";
import AdminBillingPage from "./pages/admin/AdminBillingPage.jsx";
import AdminManagersPage from "./pages/admin/AdminManagersPage.jsx";
import AdminChatLogPage from "./pages/admin/AdminChatLogPage.jsx";
import AdminSettingsPage from "./pages/admin/AdminSettingsPage.jsx";
import AdminNotesTasksPage from "./pages/admin/AdminNotesTasksPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import ManagerLoginPage from "./pages/ManagerLoginPage.jsx";
import AdminLoginPage from "./pages/AdminLoginPage.jsx";
import { RequireManager, RequireSuperAdmin } from "./components/RequireAuth.jsx";
import DesktopGate from "./components/DesktopGate.jsx";

export default function App() {
  return (
    <>
      <DesktopGate />
      <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/listings" element={<ListingsPage />} />
        <Route path="/business" element={<BusinessPage />} />
        <Route path="/business-claimed" element={<BusinessClaimedPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/advertise" element={<AdvertisePage />} />
        <Route path="/claim" element={<ClaimPage />} />
        <Route path="/onboarding" element={<BusinessOnboardingPage />} />
        <Route path="/manager-signup" element={<ManagerSignupPage />} />
      </Route>

      {/* ورود مدیر و سوپرادمین — تمام‌صفحه بدون هدر سایت */}
      <Route path="/login" element={<ManagerLoginPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />

      {/* صفحهٔ لینک‌تک (Biolink) بدون هدر سایت — تمام‌قد و قابل اشتراک روی دسکتاپ */}
      <Route path="/l/:slug" element={<BiolinkPublicPage />} />

      <Route
        path="/dashboard"
        element={
          <RequireManager>
            <DashboardShellLayout />
          </RequireManager>
        }
      >
        <Route index element={<DashboardOverviewPage />} />
        <Route path="edit" element={<DashboardEditPage />} />
        <Route path="careers" element={<DashboardCareersPage />} />
        <Route path="media" element={<DashboardMediaPage />} />
        <Route path="twilio" element={<DashboardTwilioSettingsPage />} />
        <Route path="calls" element={<DashboardCallsPage />} />
        <Route path="qr" element={<DashboardQrPage />} />
        <Route path="biolink" element={<DashboardBiolinkPage />} />
      </Route>

      <Route
        element={
          <RequireSuperAdmin>
            <AdminShellLayout />
          </RequireSuperAdmin>
        }
      >
        <Route path="/admin" element={<AdminHomePage />} />
        <Route path="/admin-notes" element={<AdminNotesTasksPage />} />
        <Route path="/admin-businesses" element={<AdminBusinessesPage />} />
        <Route path="/admin-add" element={<AdminAddBusinessPage />} />
        <Route path="/admin-categories" element={<AdminCategoriesPage />} />
        <Route path="/admin-qr-export" element={<AdminQrExportPage />} />
        <Route path="/admin-edit" element={<AdminEditBusinessPage />} />
        <Route path="/admin-claims" element={<AdminClaimsPage />} />
        <Route path="/admin-link" element={<AdminLinkPage />} />
        <Route path="/admin-billing" element={<AdminBillingPage />} />
        <Route path="/admin-managers" element={<AdminManagersPage />} />
        <Route path="/admin-chat-log" element={<AdminChatLogPage />} />
        <Route path="/admin-settings" element={<AdminSettingsPage />} />
        <Route path="/admin-system-logs" element={<Navigate to="/admin-settings?tab=logs" replace />} />
        <Route path="/admin-security" element={<Navigate to="/admin-settings?tab=security" replace />} />
        <Route path="/admin-super-admins" element={<Navigate to="/admin-settings?tab=super-admins" replace />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </>
  );
}
