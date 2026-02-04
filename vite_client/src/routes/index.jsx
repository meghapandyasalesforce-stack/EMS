/**
 * Centralized Route Configuration
 * Split from App.jsx for better organization and maintainability
 */

import React, { Suspense, lazy } from 'react';
import { Route } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import RouteErrorBoundary from '../components/RouteErrorBoundary';

// Helper to create lazy route element
const createLazyRoute = (Component, message) => (
  <RouteErrorBoundary>
    <Suspense fallback={<LoadingSpinner message={message} />}>
      <Component />
    </Suspense>
  </RouteErrorBoundary>
);

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

// Dashboard routes
export const dashboardRoutes = [
  {
    path: '/dashboard',
    component: lazy(() => import('../components/RoleBasedDashboard')),
    message: 'Loading dashboard...'
  },
  // New department/position-based routes
  {
    path: '/dashboard/hr',
    component: lazy(() => import('../HR/Dashboard/DashboardHR')),
    message: 'Loading HR dashboard...'
  },
  {
    path: '/dashboard/finance',
    component: lazy(() => import('../Finance/Dashboard/DashboardFinance')),
    message: 'Loading finance dashboard...'
  },
  {
    path: '/dashboard/tech',
    component: lazy(() => import('../Tech/Dashboard/DashboardTech')),
    message: 'Loading tech dashboard...'
  },
  {
    path: '/dashboard/ceo',
    component: lazy(() => import('../Administration/Dashboard/DashboardAdministration')),
    message: 'Loading CEO dashboard...'
  },
  {
    path: '/dashboard/cto',
    component: lazy(() => import('../Administration/Dashboard/DashboardAdministration')),
    message: 'Loading CTO dashboard...'
  },
  {
    path: '/dashboard/cfo',
    component: lazy(() => import('../Administration/Dashboard/DashboardAdministration')),
    message: 'Loading CFO dashboard...'
  },
  {
    path: '/dashboard/vp',
    component: lazy(() => import('../Administration/Dashboard/DashboardAdministration')),
    message: 'Loading VP dashboard...'
  },
  {
    path: '/dashboard/manager',
    component: lazy(() => import('../Manager/Dashboard/DashboardManager')),
    message: 'Loading manager dashboard...'
  },
  {
    path: '/dashboard/employee',
    component: lazy(() => import('../Employee/Dashboard/DashboardEmployee')),
    message: 'Loading employee dashboard...'
  },
  // Keep existing routes for backward compatibility
  {
    path: '/dashboard-admin',
    component: lazy(() => import('../Admin/DashboardAdmin')),
    message: 'Loading admin dashboard...'
  },
  {
    path: '/dashboard-employee',
    component: lazy(() => import('../Employee/Dashboard/DashboardEmployee')),
    message: 'Loading employee dashboard...'
  },
  {
    path: '/dashboard-hr',
    component: lazy(() => import('../HR/Dashboard/DashboardHR')),
    message: 'Loading HR dashboard...'
  },
  {
    path: '/dashboard-manager',
    component: lazy(() => import('../Manager/Dashboard/DashboardManager')),
    message: 'Loading manager dashboard...'
  },
  {
    path: '/dashboard-finance',
    component: lazy(() => import('../Finance/Dashboard/DashboardFinance')),
    message: 'Loading finance dashboard...'
  },
  {
    path: '/dashboard-administration',
    component: lazy(() => import('../Administration/Dashboard/DashboardAdministration')),
    message: 'Loading administration dashboard...'
  }
];

// Employee management routes
export const employeeRoutes = [
  {
    path: '/add',
    component: lazy(() => import('../Admin/Employee/AddEmployee')),
    message: 'Loading...'
  },
  {
    path: '/add-employee',
    component: lazy(() => import('../Admin/Employee/AddEmployee')),
    message: 'Loading...'
  },
  {
    path: '/employees',
    component: lazy(() => import('../Admin/Employee/EmployeesPage')),
    message: 'Loading employees...'
  },
  {
    path: '/employees/:employeeId',
    component: lazy(() => import('../Admin/Employee/EmployeeDetailsPage')),
    message: 'Loading employee details...'
  },
  {
    path: '/view-profile',
    component: lazy(() => import('../Employee/Profile details/ViewProfile')),
    message: 'Loading profile...'
  }
];

// Project routes
export const projectRoutes = [
  {
    path: '/add-project',
    component: lazy(() => import('../components/AddProjectProtected')),
    message: 'Loading...'
  },
  {
    path: '/projects',
    component: lazy(() => import('../Admin/project/ProjectPage')),
    message: 'Loading projects...'
  },
  {
    path: '/projects/:id',
    component: lazy(() => import('../Admin/project/ProjectDetailPage')),
    message: 'Loading project details...'
  },
  {
    path: '/employee/projects',
    component: lazy(() => import('../Employee/Project/EmployeeProjects')),
    message: 'Loading projects...'
  },
  {
    path: '/employee/projects/:projectId',
    component: lazy(() => import('../Employee/Project/EmployeeTasks')),
    message: 'Loading tasks...'
  }
];

// Profile detail routes
export const profileDetailRoutes = [
  {
    path: '/profile-details',
    component: lazy(() => import('../Employee/Profile details/ProfileDetails')),
    message: 'Loading profile details...'
  },
  {
    path: '/contact-details',
    component: lazy(() => import('../Employee/Profile details/ContactDetails')),
    message: 'Loading contact details...'
  },
  {
    path: '/next-of-kin-details',
    component: lazy(() => import('../Employee/Additional details/NextOfKinDetails')),
    message: 'Loading...'
  },
  {
    path: '/education-qualifications',
    component: lazy(() => import('../Employee/Profile details/EducationQualifications')),
    message: 'Loading...'
  },
  {
    path: '/guarantor-details',
    component: lazy(() => import('../Employee/Additional details/GuarantorDetails')),
    message: 'Loading...'
  },
  {
    path: '/family-details',
    component: lazy(() => import('../Employee/Additional details/FamilyDetails')),
    message: 'Loading...'
  },
  {
    path: '/job-details',
    component: lazy(() => import('../Employee/Additional details/JobDetails')),
    message: 'Loading...'
  },
  {
    path: '/financial-details',
    component: lazy(() => import('../Employee/Profile details/FinancialDetails')),
    message: 'Loading...'
  }
];

// Leave routes
export const leaveRoutes = [
  {
    path: '/leave',
    component: lazy(() => import('../Employee/Leave/LeaveApplication')),
    message: 'Loading leave application...'
  },
  {
    path: '/my-leave',
    component: lazy(() => import('../Employee/Leave/MyLeave')),
    message: 'Loading leave history...'
  },
  {
    path: '/leave-management',
    component: lazy(() => import('../Admin/LeaveManagement')),
    message: 'Loading leave management...'
  }
];

// Payroll routes
export const payrollRoutes = [
  {
    path: '/employee-payroll',
    component: lazy(() => import('../Employee/Payroll/EmployeePayroll')),
    message: 'Loading payroll...'
  },
  {
    path: '/admin-payroll',
    component: lazy(() => import('../Admin/Payroll/AdminPayroll')),
    message: 'Loading admin payroll...'
  },
  {
    path: '/admin-employee-payroll/:employeeId',
    component: lazy(() => import('../Admin/Payroll/AdminEmployeePayroll')),
    message: 'Loading employee payroll...'
  },
  {
    path: '/add-payroll',
    component: lazy(() => import('../Admin/Payroll/AddPayroll')),
    message: 'Loading...'
  },
  {
    path: '/add-payroll/:employeeId/:month/:year',
    component: lazy(() => import('../Admin/Payroll/UpdatePayroll')),
    message: 'Loading payroll update...'
  }
];

// Attendance routes
export const attendanceRoutes = [
  {
    path: '/attendance',
    component: lazy(() => import('../Both/AttendanceDashboard')),
    message: 'Loading attendance...'
  },
  {
    path: '/attendance-stats',
    component: lazy(() => import('../Employee/Attendance/AttendanceStats')),
    message: 'Loading attendance stats...'
  },
  {
    path: '/today-attendance',
    component: lazy(() => import('../Admin/Attendance/TodayStatusComponent')),
    message: "Loading today's attendance..."
  },
  {
    path: '/all-attendance-history',
    component: lazy(() => import('../Admin/Attendance/AllAttendanceStatsComponent')),
    message: 'Loading attendance history...'
  },
  {
    path: '/attendance-regularization',
    component: lazy(() => import('../Manager/AttendanceRegularization/RegularizationRequests')),
    message: 'Loading attendance regularization...'
  },
  {
    path: '/my-attendance-regularization',
    component: lazy(() => import('../Employee/AttendanceRegularization/MyRegularizationRequests')),
    message: 'Loading my attendance regularization...'
  },
  {
    path: '/team-learning',
    component: lazy(() => import('../components/TeamLearningRouteWrapper')),
    message: 'Loading team learning...'
  },
  {
    path: '/one-on-one',
    component: lazy(() => import('../components/OneOnOneRouteWrapper')),
    message: 'Loading one-on-one meetings...'
  }
];

// Organization routes
export const organizationRoutes = [
  {
    path: '/organization/profile',
    component: lazy(() => import('../Admin/Organization/OrganizationProfile')),
    message: 'Loading organization profile...'
  },
  {
    path: '/organization/dashboard',
    component: lazy(() => import('../Admin/Organization/OrganizationDashboard')),
    message: 'Loading organization dashboard...'
  },
  {
    path: '/organization/settings',
    component: lazy(() => import('../Admin/Organization/OrganizationSettings')),
    message: 'Loading organization settings...'
  },
  {
    path: '/organization/onboarding',
    component: lazy(() => import('../Admin/Organization/OrganizationOnboarding')),
    message: 'Loading onboarding...'
  },
  {
    path: '/organization/subscription',
    component: lazy(() => import('../Admin/Organization/SubscriptionManagement')),
    message: 'Loading subscription...'
  },
  {
    path: '/organization/verification',
    component: lazy(() => import('../Admin/Organization/OrganizationVerification')),
    message: 'Loading verification...'
  },
  {
    path: '/organization/analytics',
    component: lazy(() => import('../Admin/Organization/OrganizationAnalytics')),
    message: 'Loading analytics...'
  },
  {
    path: '/organization/referrals',
    component: lazy(() => import('../Admin/Organization/ReferralProgram')),
    message: 'Loading referrals...'
  },
  {
    path: '/organization/domain',
    component: lazy(() => import('../Admin/Organization/DomainVerification')),
    message: 'Loading domain verification...'
  }
];

// Admin management routes
export const adminRoutes = [
  {
    path: '/role-hierarchy',
    component: lazy(() => import('../Admin/RoleManagement/RoleHierarchy')),
    message: 'Loading role hierarchy...'
  },
  {
    path: '/calendar-management',
    component: lazy(() => import('../Admin/Calendar/CalendarManagement')),
    message: 'Loading calendar management...'
  },
  {
    path: '/id-card-generator',
    component: lazy(() => import('../Admin/IdCards/IdCardGenerator')),
    message: 'Loading ID card generator...'
  },
  {
    path: '/employee/id-card',
    component: lazy(() => import('../Employee/IdCardView')),
    message: 'Loading ID card...'
  },
  {
    path: '/salary-structure',
    component: lazy(() => import('../Admin/SalaryStructure/SalaryStructureManager')),
    message: 'Loading salary structure...'
  },
  {
    path: '/attendance-rules',
    component: lazy(() => import('../Admin/Attendance/AttendanceRules')),
    message: 'Loading attendance rules...'
  },
  {
    path: '/admin-settings',
    component: lazy(() => import('../Admin/Settings/AdminSettings')),
    message: 'Loading admin settings...'
  },
  {
    path: '/admin/leave-policy',
    component: lazy(() => import('../HR/Leave/LeavePolicyManagement')),
    message: 'Loading leave policy management...'
  },
  {
    path: '/admin/leave-balance',
    component: lazy(() => import('../Admin/Leave/EmployeeLeaveBalanceViewer')),
    message: 'Loading employee leave balances...'
  },
  {
    path: '/admin/policies',
    component: lazy(() => import('../Admin/PolicyManagement/PolicyManager')),
    message: 'Loading policies...'
  },
  {
    path: '/admin/policies/create',
    component: lazy(() => import('../Admin/PolicyManagement/CreatePolicy')),
    message: 'Loading create policy...'
  },
  {
    path: '/employee/policies',
    component: lazy(() => import('../Employee/Policies/ViewPolicies')),
    message: 'Loading policies...'
  }
];

// HR Feature routes
export const hrRoutes = [
  {
    path: '/recruitment',
    component: lazy(() => import('../HR/Recruitment/RecruitmentPage')),
    message: 'Loading recruitment...'
  },
  {
    path: '/onboarding',
    component: lazy(() => import('../components/OnboardingRouteWrapper')),
    message: 'Loading onboarding...'
  },
  {
    path: '/onboarding/:id',
    component: lazy(() => import('../HR/Onboarding/OnboardingDetailPage')),
    message: 'Loading workflow details...'
  },
  {
    path: '/learning',
    component: lazy(() => import('../HR/Learning/LearningPage')),
    message: 'Loading learning & development...'
  },
  {
    path: '/learning/create-course',
    component: lazy(() => import('../HR/Learning/CreateCourse')),
    message: 'Loading course creator...'
  },
  {
    path: '/engagement',
    component: lazy(() => import('../HR/Engagement/EngagementPage')),
    message: 'Loading employee engagement...'
  },
  {
    path: '/engagement/create-survey',
    component: lazy(() => import('../HR/Engagement/CreateSurvey')),
    message: 'Loading survey builder...'
  },
  {
    path: '/documents',
    component: lazy(() => import('../HR/Documents/DocumentsPage')),
    message: 'Loading documents...'
  },
  {
    path: '/documents/:id/versions',
    component: lazy(() => import('../HR/Documents/DocumentVersions')),
    message: 'Loading document versions...'
  },
  {
    path: '/benefits',
    component: lazy(() => import('../HR/Benefits/BenefitsPage')),
    message: 'Loading benefits...'
  },
  {
    path: '/benefits/:id',
    component: lazy(() => import('../HR/Benefits/BenefitDetailPage')),
    message: 'Loading benefit plan details...'
  },
  {
    path: '/succession',
    component: lazy(() => import('../HR/Succession/SuccessionPage')),
    message: 'Loading succession planning...'
  },
  {
    path: '/succession/:id',
    component: lazy(() => import('../HR/Succession/SuccessionDetailPage')),
    message: 'Loading succession plan details...'
  },
  {
    path: '/workforce',
    component: lazy(() => import('../HR/Workforce/WorkforcePage')),
    message: 'Loading workforce planning...'
  },
  {
    path: '/workforce/:id',
    component: lazy(() => import('../HR/Workforce/WorkforceDetailPage')),
    message: 'Loading workforce plan details...'
  },
  {
    path: '/helpdesk',
    component: lazy(() => import('../HR/Helpdesk/HelpdeskPage')),
    message: 'Loading helpdesk...'
  },
  {
    path: '/admin/reports',
    component: lazy(() => import('../HR/Reports/HRReportsPage')),
    message: 'Loading HR reports...'
  }
];

// Other routes
export const otherRoutes = [
  {
    path: '/employee/calendar',
    component: lazy(() => import('../Employee/Calendar/EmployeeCalendar')),
    message: 'Loading calendar...'
  },
  {
    path: '/notifications',
    component: lazy(() => import('../Both/Notifications')),
    message: 'Loading notifications...'
  },
  {
    path: '/daily-report',
    component: lazy(() => import('../Others/DailyReport')),
    message: 'Loading daily report...'
  },
  {
    path: '*',
    component: lazy(() => import('../Others/NotFound')),
    message: 'Loading...'
  }
];

/**
 * Render routes from configuration
 */
export const renderRoutes = (routes) => {
  return routes.map((route) => {
    // Check condition if provided
    if (route.condition && !route.condition()) {
      return null;
    }
    
    return (
      <Route
        key={route.path}
        path={route.path}
        element={createLazyRoute(route.component, route.message)}
      />
    );
  }).filter(Boolean);
};

