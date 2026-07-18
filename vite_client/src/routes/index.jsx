/**
 * Centralized Route Configuration
 * Split from App.jsx for better organization and maintainability.
 * Role-based protection: each non-auth route has allowedRoles.
 * Empty array [] = any authenticated user. Otherwise ['admin'], ['admin','hr'], etc.
 */

import React, { Suspense, lazy } from 'react';
import { Route } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import RouteErrorBoundary from '../components/RouteErrorBoundary';
import ProtectedRoute from '../components/ProtectedRoute';
import { ROUTE_PERMISSIONS } from '../utils/permissions';

// Helper to create lazy route element (unprotected - for auth routes)
const createLazyRoute = (Component, message) => (
  <RouteErrorBoundary>
    <Suspense fallback={<LoadingSpinner message={message} />}>
      <Component />
    </Suspense>
  </RouteErrorBoundary>
);

// Helper to create protected lazy route: wraps with ProtectedRoute and uses allowedRoles from config
const createProtectedLazyRoute = (route) => {
  const {
    path,
    component: Component,
    message,
    allowedRoles = [],
    requiredPermissions = [],
    redirectTo,
    orgOwnerOnly = false,
  } = route;
  return (
    <Route
      key={path}
      path={path}
      element={
        <ProtectedRoute
          allowedRoles={allowedRoles}
          requiredPermissions={requiredPermissions}
          redirectTo={redirectTo}
          orgOwnerOnly={orgOwnerOnly}
        >
          <RouteErrorBoundary>
            <Suspense fallback={<LoadingSpinner message={message} />}>
              <Component />
            </Suspense>
          </RouteErrorBoundary>
        </ProtectedRoute>
      }
    />
  );
};

// Authentication routes
export const authRoutes = [
  {
    path: '/',
    component: lazy(() => import('../Auth/Login')),
    message: 'Loading login...'
  },
  {
    path: '/login',
    component: lazy(() => import('../Auth/Login')),
    message: 'Loading login...'
  },
  {
    path: '/register',
    component: lazy(() => import('../Auth/Register')),
    message: 'Loading registration...',
    condition: () => import.meta.env.MODE === 'development' || import.meta.env.VITE_ALLOW_REGISTRATION === 'true'
  },
  {
    path: '/organization/register',
    component: lazy(() => import('../Auth/OrganizationRegister')),
    message: 'Loading organization registration...'
  },
  {
    path: '/organization/login',
    component: lazy(() => import('../Auth/OrganizationLogin')),
    message: 'Loading organization login...'
  },
  {
    path: '/forgot-password',
    component: lazy(() => import('../Both/ForgotPasswordEmail')),
    message: 'Loading...'
  },
  {
    path: '/reset-password/:token',
    component: lazy(() => import('../Both/ResetPassword')),
    message: 'Loading password reset...'
  }
];

// Dashboard routes - allowedRoles restrict who can open each dashboard by URL
export const dashboardRoutes = [
  { path: '/dashboard', component: lazy(() => import('../components/RoleBasedDashboard')), message: 'Loading dashboard...', allowedRoles: [] },
  { path: '/dashboard/hr', component: lazy(() => import('../HR/Dashboard/DashboardHR')), message: 'Loading HR dashboard...', allowedRoles: ['admin', 'hr', 'executive'], requiredPermissions: ROUTE_PERMISSIONS.hrDashboard },
  { path: '/dashboard/finance', component: lazy(() => import('../Finance/Dashboard/DashboardFinance')), message: 'Loading finance dashboard...', allowedRoles: ['admin', 'finance', 'executive'], requiredPermissions: ROUTE_PERMISSIONS.financeDashboard },
  { path: '/dashboard/tech', component: lazy(() => import('../Tech/Dashboard/DashboardTech')), message: 'Loading tech dashboard...', allowedRoles: ['admin', 'tech', 'executive'] },
  { path: '/dashboard/ceo', component: lazy(() => import('../Administration/Dashboard/DashboardAdministration')), message: 'Loading CEO dashboard...', allowedRoles: ['admin', 'executive'] },
  { path: '/dashboard/cto', component: lazy(() => import('../Administration/Dashboard/DashboardAdministration')), message: 'Loading CTO dashboard...', allowedRoles: ['admin', 'executive'] },
  { path: '/dashboard/cfo', component: lazy(() => import('../Administration/Dashboard/DashboardAdministration')), message: 'Loading CFO dashboard...', allowedRoles: ['admin', 'executive'] },
  { path: '/dashboard/vp', component: lazy(() => import('../Administration/Dashboard/DashboardAdministration')), message: 'Loading VP dashboard...', allowedRoles: ['admin', 'executive'] },
  { path: '/dashboard/manager', component: lazy(() => import('../Manager/Dashboard/DashboardManager')), message: 'Loading manager dashboard...', allowedRoles: ['admin', 'hr', 'manager', 'executive'] },
  { path: '/dashboard/employee', component: lazy(() => import('../Employee/Dashboard/DashboardEmployee')), message: 'Loading employee dashboard...', allowedRoles: [] },
  { path: '/dashboard-admin', component: lazy(() => import('../Admin/DashboardAdmin')), message: 'Loading admin dashboard...', allowedRoles: ['admin'], requiredPermissions: ROUTE_PERMISSIONS.adminDashboard },
  { path: '/dashboard-employee', component: lazy(() => import('../Employee/Dashboard/DashboardEmployee')), message: 'Loading employee dashboard...', allowedRoles: [] },
  { path: '/dashboard-hr', component: lazy(() => import('../HR/Dashboard/DashboardHR')), message: 'Loading HR dashboard...', allowedRoles: ['admin', 'hr', 'executive'], requiredPermissions: ROUTE_PERMISSIONS.hrDashboard },
  { path: '/dashboard-manager', component: lazy(() => import('../Manager/Dashboard/DashboardManager')), message: 'Loading manager dashboard...', allowedRoles: ['admin', 'hr', 'manager', 'executive'], requiredPermissions: ROUTE_PERMISSIONS.managerDashboard },
  { path: '/dashboard-finance', component: lazy(() => import('../Finance/Dashboard/DashboardFinance')), message: 'Loading finance dashboard...', allowedRoles: ['admin', 'finance', 'executive'], requiredPermissions: ROUTE_PERMISSIONS.financeDashboard },
  { path: '/dashboard-administration', component: lazy(() => import('../Administration/Dashboard/DashboardAdministration')), message: 'Loading administration dashboard...', allowedRoles: ['admin', 'executive'], requiredPermissions: ROUTE_PERMISSIONS.executiveDashboard }
];

// Employee management routes
export const employeeRoutes = [
  { path: '/add', component: lazy(() => import('../Admin/Employee/AddEmployee')), message: 'Loading...', allowedRoles: ['admin', 'hr'], requiredPermissions: ROUTE_PERMISSIONS.addEmployee },
  { path: '/add-employee', component: lazy(() => import('../Admin/Employee/AddEmployee')), message: 'Loading...', allowedRoles: ['admin', 'hr'], requiredPermissions: ROUTE_PERMISSIONS.addEmployee },
  { path: '/employees', component: lazy(() => import('../Admin/Employee/EmployeesPage')), message: 'Loading employees...', allowedRoles: ['admin', 'hr', 'manager', 'executive'], requiredPermissions: ROUTE_PERMISSIONS.employees },
  { path: '/employees/:employeeId', component: lazy(() => import('../Admin/Employee/EmployeeDetailsPage')), message: 'Loading employee details...', allowedRoles: ['admin', 'hr', 'manager', 'executive'], requiredPermissions: ROUTE_PERMISSIONS.employeeDetails },
  { path: '/view-profile', component: lazy(() => import('../Employee/Profile details/ViewProfile')), message: 'Loading profile...', allowedRoles: [] }
];

// Project routes
export const projectRoutes = [
  { path: '/add-project', component: lazy(() => import('../Admin/project/AddProject')), message: 'Loading...', allowedRoles: ['admin', 'manager', 'project_manager', 'hr', 'executive'], requiredPermissions: ROUTE_PERMISSIONS.projects },
  { path: '/projects', component: lazy(() => import('../Admin/project/ProjectPage')), message: 'Loading projects...', allowedRoles: ['admin', 'hr', 'manager', 'project_manager', 'executive'], requiredPermissions: ROUTE_PERMISSIONS.projects },
  { path: '/projects/:id', component: lazy(() => import('../Admin/project/ProjectDetailPage')), message: 'Loading project details...', allowedRoles: ['admin', 'hr', 'manager', 'project_manager', 'executive'], requiredPermissions: ROUTE_PERMISSIONS.projects },
  { path: '/employee/projects', component: lazy(() => import('../Employee/Project/EmployeeProjects')), message: 'Loading projects...', allowedRoles: [] },
  { path: '/employee/projects/:projectId', component: lazy(() => import('../Employee/Project/EmployeeTasks')), message: 'Loading tasks...', allowedRoles: [] }
];

// Profile detail routes - single route, tab driven by URL internally
const ProfileDetailsPage = lazy(() => import('../Employee/Profile details/ProfileDetails'));
export const profileDetailRoutes = [
  { path: '/profile-details', component: ProfileDetailsPage, message: 'Loading profile details...', allowedRoles: [] },
  { path: '/contact-details', component: ProfileDetailsPage, message: 'Loading profile details...', allowedRoles: [] },
  { path: '/education-qualifications', component: ProfileDetailsPage, message: 'Loading profile details...', allowedRoles: [] },
  { path: '/family-details', component: ProfileDetailsPage, message: 'Loading profile details...', allowedRoles: [] },
  { path: '/job-details', component: ProfileDetailsPage, message: 'Loading profile details...', allowedRoles: [] },
  { path: '/financial-details', component: ProfileDetailsPage, message: 'Loading profile details...', allowedRoles: [] }
];

export const renderProfileRoutes = () => {
  const paths = [
    '/profile-details',
    '/contact-details',
    '/education-qualifications',
    '/family-details',
    '/job-details',
    '/financial-details',
  ];

  return paths.map((path) => (
    <Route
      key={path}
      path={path}
      element={
        <ProtectedRoute allowedRoles={[]}>
          <RouteErrorBoundary>
            <Suspense fallback={<LoadingSpinner message="Loading profile details..." />}>
              <ProfileDetailsPage />
            </Suspense>
          </RouteErrorBoundary>
        </ProtectedRoute>
      }
    />
  ));
};

// Leave routes
export const leaveRoutes = [
  { path: '/leave', component: lazy(() => import('../Employee/Leave/LeaveApplication')), message: 'Loading leave application...', allowedRoles: [] },
  { path: '/my-leave', component: lazy(() => import('../Employee/LeaveAttendance/LeaveAttendanceHub')), message: 'Loading leave & attendance...', allowedRoles: [] },
  { path: '/employee/leave-attendance', component: lazy(() => import('../Employee/LeaveAttendance/LeaveAttendanceHub')), message: 'Loading leave & attendance...', allowedRoles: [] },
  { path: '/leave-management', component: lazy(() => import('../Admin/LeaveManagement')), message: 'Loading leave management...', allowedRoles: ['admin', 'hr', 'hr_executive', 'manager', 'executive'], requiredPermissions: ROUTE_PERMISSIONS.leaveManagement }
];

// Payroll routes
export const payrollRoutes = [
  { path: '/employee-payroll', component: lazy(() => import('../Employee/Payroll/EmployeePayroll')), message: 'Loading payroll...', allowedRoles: [] },
  { path: '/admin-payroll', component: lazy(() => import('../Admin/Payroll/AdminPayroll')), message: 'Loading admin payroll...', allowedRoles: ['admin', 'hr', 'executive', 'finance'], requiredPermissions: ROUTE_PERMISSIONS.adminPayroll },
  { path: '/admin-employee-payroll/:employeeId', component: lazy(() => import('../Admin/Payroll/AdminEmployeePayroll')), message: 'Loading employee payroll...', allowedRoles: ['admin', 'hr', 'manager', 'executive'], requiredPermissions: ROUTE_PERMISSIONS.adminPayroll },
  { path: '/add-payroll', component: lazy(() => import('../Admin/Payroll/AddPayroll')), message: 'Loading...', allowedRoles: ['admin', 'hr', 'executive', 'finance'], requiredPermissions: ROUTE_PERMISSIONS.payrollCreate },
  { path: '/add-payroll/:employeeId/:month/:year', component: lazy(() => import('../Admin/Payroll/UpdatePayroll')), message: 'Loading payroll update...', allowedRoles: ['admin', 'hr', 'executive'], requiredPermissions: ROUTE_PERMISSIONS.payrollEdit }
];

// Attendance routes
export const attendanceRoutes = [
  { path: '/attendance', component: lazy(() => import('../Both/AttendanceDashboard')), message: 'Loading attendance...', allowedRoles: [] },
  { path: '/attendance-stats', component: lazy(() => import('../Employee/LeaveAttendance/LeaveAttendanceHub')), message: 'Loading leave & attendance...', allowedRoles: [] },
  { path: '/today-attendance', component: lazy(() => import('../Admin/Attendance/TodayStatusComponent')), message: "Loading today's attendance...", allowedRoles: ['admin', 'hr', 'manager', 'executive'], requiredPermissions: ROUTE_PERMISSIONS.attendanceToday },
  { path: '/all-attendance-history', component: lazy(() => import('../Admin/Attendance/AllAttendanceStatsComponent')), message: 'Loading attendance history...', allowedRoles: ['admin', 'hr', 'manager', 'executive'], requiredPermissions: ROUTE_PERMISSIONS.attendanceAll },
  { path: '/attendance-regularization', component: lazy(() => import('../Manager/AttendanceRegularization/RegularizationRequests')), message: 'Loading attendance regularization...', allowedRoles: ['admin', 'hr', 'manager', 'executive'] },
  { path: '/manager/attendance-regularization', component: lazy(() => import('../Manager/AttendanceRegularization/RegularizationRequests')), message: 'Loading attendance regularization...', allowedRoles: ['admin', 'hr', 'manager', 'executive'] },
  { path: '/my-attendance-regularization', component: lazy(() => import('../Employee/AttendanceRegularization/MyRegularizationRequests')), message: 'Loading my attendance regularization...', allowedRoles: [] },
  { path: '/team-learning', component: lazy(() => import('../Manager/TeamLearning/TeamLearningPage')), message: 'Loading team learning...', allowedRoles: [] },
  { path: '/one-on-one', component: lazy(() => import('../components/OneOnOneRouteWrapper')), message: 'Loading one-on-one meetings...', allowedRoles: [] }
];

// Organization routes - admin only
export const organizationRoutes = [
  { path: '/organization/profile', component: lazy(() => import('../Admin/Organization/OrganizationProfile')), message: 'Loading organization profile...', allowedRoles: ['admin', 'executive'], requiredPermissions: ROUTE_PERMISSIONS.orgSettings },
  { path: '/organization/dashboard', component: lazy(() => import('../Admin/Organization/OrganizationDashboard')), message: 'Loading organization dashboard...', allowedRoles: ['admin', 'executive'], requiredPermissions: ROUTE_PERMISSIONS.orgSettings },
  { path: '/organization/settings', component: lazy(() => import('../Admin/Organization/OrganizationSettings')), message: 'Loading organization settings...', allowedRoles: ['admin', 'executive'] },
  { path: '/organization/onboarding', component: lazy(() => import('../Admin/Organization/OrganizationOnboarding')), message: 'Loading onboarding...', allowedRoles: ['admin', 'executive'] },
  { path: '/organization/subscription', component: lazy(() => import('../Admin/Organization/SubscriptionManagement')), message: 'Loading subscription...', allowedRoles: ['admin', 'executive'] },
  { path: '/organization/verification', component: lazy(() => import('../Admin/Organization/OrganizationVerification')), message: 'Loading verification...', allowedRoles: ['admin', 'executive'] },
  { path: '/organization/analytics', component: lazy(() => import('../Admin/Organization/OrganizationAnalytics')), message: 'Loading analytics...', allowedRoles: ['admin', 'executive'] },
  { path: '/organization/referrals', component: lazy(() => import('../Admin/Organization/ReferralProgram')), message: 'Loading referrals...', allowedRoles: ['admin', 'executive'] },
  { path: '/organization/domain', component: lazy(() => import('../Admin/Organization/DomainVerification')), message: 'Loading domain verification...', allowedRoles: ['admin', 'executive'] }
];

// Admin management routes
export const adminRoutes = [
  { path: '/role-hierarchy', component: lazy(() => import('../Admin/RoleManagement/RoleHierarchy')), message: 'Loading role hierarchy...', allowedRoles: ['admin', 'hr', 'executive'], requiredPermissions: ROUTE_PERMISSIONS.roleHierarchy },
  { path: '/admin/platform-roles', component: lazy(() => import('../Admin/RoleManagement/UsersRolesPage')), message: 'Loading users & roles...', allowedRoles: ['admin', 'hr'], requiredPermissions: ROUTE_PERMISSIONS.platformRoles },
  { path: '/calendar-management', component: lazy(() => import('../Admin/Calendar/CalendarManagement')), message: 'Loading calendar management...', allowedRoles: ['admin', 'hr', 'executive'], requiredPermissions: ROUTE_PERMISSIONS.leavePolicy },
  { path: '/id-card-generator', component: lazy(() => import('../Admin/IdCards/IdCardGenerator')), message: 'Loading ID card generator...', allowedRoles: ['admin', 'hr', 'executive'] },
  { path: '/employee/id-card', component: lazy(() => import('../Employee/DocumentsAndId/DocumentsAndIdPage')), message: 'Loading documents & ID card...', allowedRoles: [] },
  { path: '/salary-structure', component: lazy(() => import('../Admin/SalaryStructure/SalaryStructureManager')), message: 'Loading salary structure...', allowedRoles: ['admin', 'hr', 'finance', 'executive'], requiredPermissions: ROUTE_PERMISSIONS.salaryStructure },
  { path: '/attendance-rules', component: lazy(() => import('../Admin/Attendance/AttendanceRules')), message: 'Loading attendance rules...', allowedRoles: ['admin', 'hr', 'executive'], requiredPermissions: ROUTE_PERMISSIONS.attendanceRules },
  { path: '/admin-settings', component: lazy(() => import('../Admin/Settings/AdminSettings')), message: 'Loading admin settings...', allowedRoles: ['admin', 'hr', 'executive'], requiredPermissions: ROUTE_PERMISSIONS.adminSettings },
  { path: '/admin/leave-policy', component: lazy(() => import('../HR/Leave/LeavePolicyManagement')), message: 'Loading leave policy management...', allowedRoles: ['admin', 'hr', 'executive'], requiredPermissions: ROUTE_PERMISSIONS.leavePolicy },
  { path: '/admin/leave-balance', component: lazy(() => import('../Admin/Leave/EmployeeLeaveBalanceViewer')), message: 'Loading employee leave balances...', allowedRoles: ['admin', 'hr', 'executive'] },
  { path: '/admin/leave-reports', component: lazy(() => import('../Admin/Leave/LeaveReportsPage')), message: 'Loading leave reports...', allowedRoles: ['admin', 'hr', 'executive'], requiredPermissions: ROUTE_PERMISSIONS.leavePolicy },
  { path: '/admin/policies/create', component: lazy(() => import('../Admin/PolicyManagement/CreatePolicy')), message: 'Loading create policy...', allowedRoles: ['admin', 'hr', 'executive'] },
  { path: '/admin/policies/:policyId/edit', component: lazy(() => import('../Admin/PolicyManagement/EditPolicy')), message: 'Loading edit policy...', allowedRoles: ['admin', 'hr', 'executive'] },
  { path: '/admin/policies/:policyId', component: lazy(() => import('../Admin/PolicyManagement/ViewPolicy')), message: 'Loading policy...', allowedRoles: ['admin', 'hr', 'executive'] },
  { path: '/admin/policies', component: lazy(() => import('../Admin/PolicyManagement/PolicyManager')), message: 'Loading policies...', allowedRoles: ['admin', 'hr', 'executive'] },
  { path: '/admin/approval-workflows', component: lazy(() => import('../Admin/ApprovalWorkflows/WorkflowManager')), message: 'Loading approval workflows...', allowedRoles: ['admin', 'hr', 'executive'] },
  { path: '/admin/pending-approvals', component: lazy(() => import('../Admin/ApprovalWorkflows/PendingApprovals')), message: 'Loading pending approvals...', allowedRoles: ['admin', 'hr', 'manager', 'executive'], requiredPermissions: ROUTE_PERMISSIONS.pendingApprovals },
  { path: '/employee/policies', component: lazy(() => import('../Employee/Policies/ViewPolicies')), message: 'Loading policies...', allowedRoles: [] }
];

// HR Feature routes - admin and HR
export const hrRoutes = [
  { path: '/recruitment', component: lazy(() => import('../HR/Recruitment/RecruitmentPage')), message: 'Loading recruitment...', allowedRoles: ['admin', 'hr', 'executive'], requiredPermissions: ROUTE_PERMISSIONS.recruitment },
  { path: '/onboarding', component: lazy(() => import('../components/OnboardingRouteWrapper')), message: 'Loading onboarding...', allowedRoles: ['admin', 'hr', 'executive'], requiredPermissions: ROUTE_PERMISSIONS.onboarding },
  { path: '/onboarding/:id', component: lazy(() => import('../HR/Onboarding/OnboardingDetailPage')), message: 'Loading workflow details...', allowedRoles: ['admin', 'hr', 'executive'] },
  { path: '/learning', component: lazy(() => import('../components/LearningRouteWrapper')), message: 'Loading learning & development...', allowedRoles: [] },
  { path: '/learning/courses/:courseId', component: lazy(() => import('../Employee/Learning/CourseDetailsPage')), message: 'Loading course details...', allowedRoles: [] },
  { path: '/employee/benefits-learning', component: lazy(() => import('../Employee/Learning/BenefitsLearningHub')), message: 'Loading benefits and learning...', allowedRoles: [] },
  { path: '/learning/create-course', component: lazy(() => import('../HR/Learning/CreateCourse')), message: 'Loading course creator...', allowedRoles: ['admin', 'hr', 'executive'] },
  { path: '/learning/edit-course/:courseId', component: lazy(() => import('../HR/Learning/EditCourse')), message: 'Loading course editor...', allowedRoles: ['admin', 'hr', 'executive'] },
  { path: '/engagement', component: lazy(() => import('../HR/Engagement/EngagementPage')), message: 'Loading employee engagement...', allowedRoles: [] },
  { path: '/engagement/surveys/:surveyId', component: lazy(() => import('../HR/Engagement/SurveyDetailPage')), message: 'Loading survey...', allowedRoles: [] },
  { path: '/engagement/create-survey', component: lazy(() => import('../HR/Engagement/CreateSurvey')), message: 'Loading survey builder...', allowedRoles: ['admin', 'hr', 'executive'] },
  { path: '/documents', component: lazy(() => import('../HR/Documents/DocumentsPage')), message: 'Loading documents...', allowedRoles: ['admin', 'hr', 'executive'] },
  { path: '/employee/documents-id', component: lazy(() => import('../Employee/DocumentsAndId/DocumentsAndIdPage')), message: 'Loading documents & ID card...', allowedRoles: [] },
  { path: '/employee/my-documents', component: lazy(() => import('../Employee/Documents/MyDocumentsPage')), message: 'Loading my documents...', allowedRoles: [] },
  { path: '/documents/:id/versions', component: lazy(() => import('../HR/Documents/DocumentVersions')), message: 'Loading document versions...', allowedRoles: ['admin', 'hr', 'executive'] },
  { path: '/benefits', component: lazy(() => import('../components/BenefitsRouteWrapper')), message: 'Loading benefits...', allowedRoles: [] },
  { path: '/benefits/:id', component: lazy(() => import('../HR/Benefits/BenefitDetailPage')), message: 'Loading benefit plan details...', allowedRoles: [] },
  { path: '/succession', component: lazy(() => import('../HR/Succession/SuccessionPage')), message: 'Loading succession planning...', allowedRoles: ['admin', 'hr', 'executive'] },
  { path: '/succession/:id', component: lazy(() => import('../HR/Succession/SuccessionDetailPage')), message: 'Loading succession plan details...', allowedRoles: ['admin', 'hr', 'executive'] },
  { path: '/workforce', component: lazy(() => import('../HR/Workforce/WorkforcePage')), message: 'Loading workforce planning...', allowedRoles: ['admin', 'hr', 'executive'] },
  { path: '/workforce/:id', component: lazy(() => import('../HR/Workforce/WorkforceDetailPage')), message: 'Loading workforce plan details...', allowedRoles: ['admin', 'hr', 'executive'] },
  { path: '/helpdesk', component: lazy(() => import('../HR/Helpdesk/HelpdeskPage')), message: 'Loading helpdesk...', allowedRoles: ['admin', 'hr', 'executive'] },
  { path: '/admin/reports/*', component: lazy(() => import('../HR/Reports/HRReportsLayout')), message: 'Loading HR reports...', allowedRoles: ['admin', 'hr', 'executive'] },
  { path: '/hr/analytics', component: lazy(() => import('../HR/Analytics/HRAnalyticsPage')), message: 'Loading HR analytics...', allowedRoles: ['admin', 'hr', 'executive'] }
];

// Other routes
export const otherRoutes = [
  { path: '/employee/calendar', component: lazy(() => import('../Employee/Calendar/EmployeeCalendar')), message: 'Loading calendar...', allowedRoles: [] },
  { path: '/notifications', component: lazy(() => import('../Both/Notifications')), message: 'Loading notifications...', allowedRoles: [] },
  { path: '/sent-announcements', component: lazy(() => import('../Admin/SentAnnouncementsPage')), message: 'Loading announcements...', allowedRoles: ['admin', 'hr', 'executive'] },
  { path: '/daily-report', component: lazy(() => import('../Others/DailyReport')), message: 'Loading daily report...', allowedRoles: [] },
  { path: '*', component: lazy(() => import('../Others/NotFound')), message: 'Loading...', allowedRoles: [] }
];

/**
 * Render public/auth routes (no role protection)
 */
export const renderRoutes = (routes) => {
  return routes.map((route) => {
    if (route.condition && !route.condition()) return null;
    return (
      <Route key={route.path} path={route.path} element={createLazyRoute(route.component, route.message)} />
    );
  }).filter(Boolean);
};

/**
 * Render protected routes (wrapped with ProtectedRoute using allowedRoles from config)
 */
export const renderProtectedRoutes = (routes) => {
  return routes.map((route) => {
    if (route.condition && !route.condition()) return null;
    return createProtectedLazyRoute(route);
  }).filter(Boolean);
};

