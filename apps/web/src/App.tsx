import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { PlaceholderPage } from './components/PlaceholderPage';
import { EssLayout } from './ess/components/EssLayout';
import { EssAttendancePage } from './ess/pages/EssAttendancePage';
import { EssDocumentsPage } from './ess/pages/EssDocumentsPage';
import { EssHomePage } from './ess/pages/EssHomePage';
import { EssLeavePage } from './ess/pages/EssLeavePage';
import { EssNotificationsPage } from './ess/pages/EssNotificationsPage';
import { EssPeoplePage, EssPersonDetailPage } from './ess/pages/EssPeoplePage';
import { EssProfilePage } from './ess/pages/EssProfilePage';
import { AppLayout } from './layout/AppLayout';
import { AdminRolesPage } from './pages/AdminRolesPage';
import { ForgotPasswordOtpPage } from './pages/ForgotPasswordOtpPage';
import { ForgotPasswordRequestPage } from './pages/ForgotPasswordRequestPage';
import { ForgotPasswordResetPage } from './pages/ForgotPasswordResetPage';
import { LoginPage } from './pages/LoginPage';

function ph(title: string, blurb: string, upcoming?: string[]) {
  return <PlaceholderPage title={title} blurb={blurb} upcoming={upcoming} />;
}

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
              <Route path="people/:id" element={<EssPersonDetailPage />} />
              <Route path="documents" element={<EssDocumentsPage />} />
              <Route path="profile" element={<EssProfilePage />} />
              <Route path="notifications" element={<EssNotificationsPage />} />
            </Route>

            <Route path="/manager" element={<RoleOutlet roles={['MANAGER']} />}>
              <Route
                index
                element={ph(
                  'Team Overview',
                  'Team signals at a glance: inbox count, who is on leave, and attendance exceptions.',
                )}
              />
              <Route
                path="inbox"
                element={ph(
                  'Approvals Inbox',
                  'Pending leave and attendance corrections for your team will appear here.',
                )}
              />
              <Route
                path="team-leave"
                element={ph(
                  'Team Leave',
                  'Calendar and list of leave across your direct reports.',
                )}
              />
              <Route
                path="team-attendance"
                element={ph(
                  'Team Attendance',
                  'Month view and exceptions for your team.',
                )}
              />
              <Route
                path="directory"
                element={ph(
                  'Team Directory',
                  'Direct reports and basic profile links.',
                )}
              />
            </Route>

            <Route
              path="/hr"
              element={<RoleOutlet roles={['HR_EXEC', 'HR_HEAD']} />}
            >
              <Route
                index
                element={ph(
                  'HR Overview',
                  'Queues for incomplete profiles, import errors, and escalations.',
                )}
              />
              <Route
                path="employees"
                element={ph(
                  'Employees',
                  'Search, create, and bulk-import employee records.',
                )}
              />
              <Route
                path="organization"
                element={ph(
                  'Organization',
                  'Departments, designations, and locations.',
                )}
              />
              <Route
                path="leave"
                element={ph(
                  'Leave Admin',
                  'Leave types, policies, balances, and holidays.',
                )}
              />
              <Route
                path="attendance"
                element={ph(
                  'Attendance Admin',
                  'CSV import, period locks, and shifts.',
                )}
              />
              <Route
                path="documents"
                element={ph(
                  'HR Documents',
                  'Categories, company documents, and compliance packs.',
                )}
              />
              <Route
                path="workflows"
                element={ph(
                  'Workflows',
                  'Workflow definitions and stuck instances.',
                )}
              />
              <Route
                path="reports"
                element={ph(
                  'HR Reports',
                  'Headcount, leave utilization, attendance summary, and attrition.',
                )}
              />
              <Route
                path="migration"
                element={ph(
                  'Migration',
                  'greytHR CSV/Excel import tools and reconciliation.',
                )}
              />
            </Route>

            <Route
              path="/admin"
              element={
                <RoleOutlet roles={['SECURITY_ADMIN', 'IT_ADMIN']} />
              }
            >
              <Route
                index
                element={ph(
                  'Admin Overview',
                  'Identity, audit, notification health, and system configuration.',
                )}
              />
              <Route
                path="roles"
                element={
                  <ProtectedRoute permission="rbac.assign">
                    <AdminRolesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="audit"
                element={ph(
                  'Audit log',
                  'Searchable trail of sensitive actions across the tenant.',
                )}
              />
              <Route
                path="notifications"
                element={ph(
                  'Notifications / Email health',
                  'Delivery status and email provider health checks.',
                )}
              />
              <Route
                path="settings"
                element={ph(
                  'System settings',
                  'SMTP, retention labels, and feature flags.',
                )}
              />
              <Route
                path="jobs"
                element={ph(
                  'Jobs',
                  'Reminder and escalation job status.',
                )}
              />
            </Route>

            <Route
              path="/exec"
              element={<RoleOutlet roles={['LEADERSHIP_READ']} />}
            >
              <Route
                index
                element={ph(
                  'Leadership Overview',
                  'Headcount, joiners/exits, and exception rates at a glance.',
                )}
              />
              <Route
                path="reports"
                element={ph(
                  'Leadership Reports',
                  'Org-wide report runner with read-only defaults.',
                )}
              />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/ess" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
