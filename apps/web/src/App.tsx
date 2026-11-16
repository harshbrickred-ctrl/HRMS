import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { EssLayout } from './ess/components/EssLayout';
import { EssAssetsPage } from './ess/pages/EssAssetsPage';
import { EssAttendancePage } from './ess/pages/EssAttendancePage';
import { EssDocumentsPage } from './ess/pages/EssDocumentsPage';
import { EssHelpdeskPage } from './ess/pages/EssHelpdeskPage';
import { EssHomePage } from './ess/pages/EssHomePage';
import { EssLeavePage } from './ess/pages/EssLeavePage';
import { EssNotificationsPage } from './ess/pages/EssNotificationsPage';
import { EssPeoplePage, EssPersonDetailPage } from './ess/pages/EssPeoplePage';
import { EssPermissionsPage } from './ess/pages/EssPermissionsPage';
import { EssProfilePage } from './ess/pages/EssProfilePage';
import { EssSalaryPage } from './ess/pages/EssSalaryPage';
import { EssSettingsPage } from './ess/pages/EssSettingsPage';
import { EssTeamPage } from './ess/pages/EssTeamPage';
import { AppLayout } from './layout/AppLayout';
import { AdminLeavePage } from './workspace/LeaveApprovalsPanel';
import { AdminRolesPage } from './pages/AdminRolesPage';
import { ForgotPasswordOtpPage } from './pages/ForgotPasswordOtpPage';
import { ForgotPasswordRequestPage } from './pages/ForgotPasswordRequestPage';
import { ForgotPasswordResetPage } from './pages/ForgotPasswordResetPage';
import { LoginPage } from './pages/LoginPage';
import {
  AdminAuditPage,
  AdminJobsPage,
  AdminMailPage,
  AdminOverviewPage,
  AdminSettingsPage,
  HrAttendanceAdminPage,
  HrDocumentsPage,
  HrEmployeesPage,
  HrLeaveAdminPage,
  HrOrganizationPage,
  HrOverviewPage,
  HrWorkflowsPage,
  LeadershipOverviewPage,
  LeadershipReportsPage,
  ManagerInboxPage,
  ManagerOverviewPage,
  TeamAttendancePage,
  TeamDirectoryPage,
  TeamLeavePage,
} from './workspace/RolePages';
import { HrSalaryPage } from './workspace/HrSalaryPage';
import { FinancePayoutPage } from './workspace/FinancePayoutPage';
import { ItAssetsPage } from './workspace/ItAssetsPage';
import { ItAssetTicketsPage } from './workspace/ItAssetTicketsPage';
import {
  ADMIN_ROLES,
  FINANCE_ROLES,
  HR_ROLES,
  IT_ROLES,
  LEADERSHIP_ROLES,
  MANAGER_ROLES,
} from './workspace/roleCatalog';

function RoleOutlet({ roles }: { roles: string[] }) {
  return (
    <ProtectedRoute roles={roles}>
      <Outlet />
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordRequestPage />} />
          <Route path="/forgot-password/otp" element={<ForgotPasswordOtpPage />} />
          <Route path="/forgot-password/reset" element={<ForgotPasswordResetPage />} />

          <Route path="/" element={<Navigate to="/ess" replace />} />

          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/ess" element={<EssLayout />}>
              <Route index element={<EssHomePage />} />
              <Route path="leave" element={<EssLeavePage />} />
              <Route path="attendance" element={<EssAttendancePage />} />
              <Route path="people" element={<EssPeoplePage />} />
              <Route path="team" element={<EssTeamPage />} />
              <Route path="people/:id" element={<EssPersonDetailPage />} />
              <Route path="documents" element={<EssDocumentsPage />} />
              <Route path="profile" element={<EssProfilePage />} />
              <Route path="permissions" element={<EssPermissionsPage />} />
              <Route path="salary" element={<EssSalaryPage />} />
              <Route path="notifications" element={<EssNotificationsPage />} />
              <Route path="settings" element={<EssSettingsPage />} />
              <Route path="helpdesk" element={<EssHelpdeskPage />} />
              <Route path="assets" element={<EssAssetsPage />} />
            </Route>

            <Route path="/manager" element={<RoleOutlet roles={[...MANAGER_ROLES]} />}>
              <Route index element={<ManagerOverviewPage />} />
              <Route path="inbox" element={<ManagerInboxPage />} />
              <Route path="team-leave" element={<TeamLeavePage />} />
              <Route path="team-attendance" element={<TeamAttendancePage />} />
              <Route path="directory" element={<TeamDirectoryPage />} />
            </Route>

            <Route
              path="/hr"
              element={<RoleOutlet roles={[...HR_ROLES, ...FINANCE_ROLES, ...ADMIN_ROLES]} />}
            >
              <Route index element={<HrOverviewPage />} />
              <Route path="employees" element={<HrEmployeesPage />} />
              <Route path="organization" element={<HrOrganizationPage />} />
              <Route path="directory" element={<TeamDirectoryPage scope="company" />} />
              <Route path="leave" element={<HrLeaveAdminPage />} />
              <Route path="attendance" element={<HrAttendanceAdminPage />} />
              <Route path="salary" element={<HrSalaryPage />} />
              <Route path="documents" element={<HrDocumentsPage />} />
              <Route path="workflows" element={<HrWorkflowsPage />} />
            </Route>

            <Route path="/admin" element={<RoleOutlet roles={[...ADMIN_ROLES, ...IT_ROLES]} />}>
              <Route index element={<AdminOverviewPage />} />
              <Route path="employees" element={<HrEmployeesPage />} />
              <Route
                path="roles"
                element={
                  <ProtectedRoute permission="rbac.assign">
                    <AdminRolesPage />
                  </ProtectedRoute>
                }
              />
              <Route path="leave" element={<AdminLeavePage />} />
              <Route
                path="audit"
                element={
                  <ProtectedRoute permission="audit.read">
                    <AdminAuditPage />
                  </ProtectedRoute>
                }
              />
              <Route path="notifications" element={<AdminMailPage />} />
              <Route path="settings" element={<AdminSettingsPage />} />
              <Route path="jobs" element={<AdminJobsPage />} />
            </Route>

            <Route path="/it" element={<RoleOutlet roles={[...IT_ROLES]} />}>
              <Route index element={<Navigate to="assets" replace />} />
              <Route path="assets" element={<ItAssetsPage />} />
              <Route path="tickets" element={<ItAssetTicketsPage />} />
            </Route>

            <Route path="/finance" element={<RoleOutlet roles={[...FINANCE_ROLES, ...ADMIN_ROLES]} />}>
              <Route index element={<Navigate to="payout" replace />} />
              <Route path="payout" element={<FinancePayoutPage />} />
              <Route path="salary" element={<Navigate to="/finance/payout" replace />} />
            </Route>

            <Route
              path="/exec"
              element={<RoleOutlet roles={[...LEADERSHIP_ROLES, ...FINANCE_ROLES]} />}
            >
              <Route index element={<LeadershipOverviewPage />} />
              <Route path="reports" element={<LeadershipReportsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/ess" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
