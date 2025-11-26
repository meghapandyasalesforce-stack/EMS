import React, { useState, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import Header from './Shared/Header';
import ProfileSidebar from './Employee/ProfileSidebar';
import InstallPrompt from './components/InstallPrompt';
import LoadingSpinner from './components/LoadingSpinner';
import RouteErrorBoundary from './components/RouteErrorBoundary';
import LazyRoute from './components/LazyRoute';

// Helper to create lazy route element
const createLazyRoute = (Component, message) => (
  <RouteErrorBoundary>
    <Suspense fallback={<LoadingSpinner message={message} />}>
      <Component />
    </Suspense>
  </RouteErrorBoundary>
);

// Lazy load authentication components
const Login = lazy(() => import('./Auth/Login'));
const Register = lazy(() => import('./Auth/Register'));
const OrganizationRegister = lazy(() => import('./Auth/OrganizationRegister'));
const OrganizationLogin = lazy(() => import('./Auth/OrganizationLogin'));

// Lazy load dashboard components
const DashboardAdmin = lazy(() => import('./Admin/DashboardAdmin'));
const DashboardEmployee = lazy(() => import('./Employee/Dashboard/DashboardEmployee'));
const DashboardHR = lazy(() => import('./HR/Dashboard/DashboardHR'));
const DashboardManager = lazy(() => import('./Manager/Dashboard/DashboardManager'));
const DashboardFinance = lazy(() => import('./Finance/Dashboard/DashboardFinance'));
const DashboardExecutive = lazy(() => import('./Executive/Dashboard/DashboardExecutive'));
const RoleBasedDashboard = lazy(() => import('./components/RoleBasedDashboard'));

// Lazy load admin components
const AddEmployee = lazy(() => import('./Admin/Employee/AddEmployee'));
const EmployeesPage = lazy(() => import('./Admin/Employee/EmployeesPage'));
const EmployeeDetailsPage = lazy(() => import('./Admin/Employee/EmployeeDetailsPage'));
const AddProject = lazy(() => import('./Admin/project/AddProject'));
const ProjectsPage = lazy(() => import('./Admin/project/ProjectPage'));
const ProjectDetailPage = lazy(() => import('./Admin/project/ProjectDetailPage'));
const LeaveManagement = lazy(() => import('./Admin/LeaveManagement'));
const AdminPayroll = lazy(() => import('./Admin/Payroll/AdminPayroll'));
const AddPayroll = lazy(() => import('./Admin/Payroll/AddPayroll'));
const UpdatePayroll = lazy(() => import('./Admin/Payroll/UpdatePayroll'));
const AdminEmployeePayroll = lazy(() => import('./Admin/Payroll/AdminEmployeePayroll'));
const TodayStatusComponent = lazy(() => import('./Admin/Attendance/TodayStatusComponent'));
const AllAttendanceStatsComponent = lazy(() => import('./Admin/Attendance/AllAttendanceStatsComponent'));
const RoleHierarchy = lazy(() => import('./Admin/RoleManagement/RoleHierarchy'));
const CalendarManagement = lazy(() => import('./Admin/Calendar/CalendarManagement'));
const IdCardGenerator = lazy(() => import('./Admin/IdCards/IdCardGenerator'));
const SalaryStructureManager = lazy(() => import('./Admin/SalaryStructure/SalaryStructureManager'));
const AttendanceRules = lazy(() => import('./Admin/Attendance/AttendanceRules'));
const AdminSettings = lazy(() => import('./Admin/Settings/AdminSettings'));
const OrganizationProfile = lazy(() => import('./Admin/Organization/OrganizationProfile'));
const OrganizationDashboard = lazy(() => import('./Admin/Organization/OrganizationDashboard'));
const OrganizationSettings = lazy(() => import('./Admin/Organization/OrganizationSettings'));
const OrganizationOnboarding = lazy(() => import('./Admin/Organization/OrganizationOnboarding'));
const SubscriptionManagement = lazy(() => import('./Admin/Organization/SubscriptionManagement'));
const OrganizationVerification = lazy(() => import('./Admin/Organization/OrganizationVerification'));
const OrganizationAnalytics = lazy(() => import('./Admin/Organization/OrganizationAnalytics'));
const ReferralProgram = lazy(() => import('./Admin/Organization/ReferralProgram'));
const DomainVerification = lazy(() => import('./Admin/Organization/DomainVerification'));
const PolicyManager = lazy(() => import('./Admin/PolicyManagement/PolicyManager'));
const CreatePolicy = lazy(() => import('./Admin/PolicyManagement/CreatePolicy'));
const ViewPolicies = lazy(() => import('./Employee/Policies/ViewPolicies'));

// Lazy load employee components
const ProfileDetails = lazy(() => import('./Employee/Profile details/ProfileDetails'));
const ContactDetails = lazy(() => import('./Employee/Profile details/ContactDetails'));
const NextOfKinDetails = lazy(() => import('./Employee/Additional details/NextOfKinDetails'));
const EducationQualifications = lazy(() => import('./Employee/Profile details/EducationQualifications'));
const GuarantorDetails = lazy(() => import('./Employee/Additional details/GuarantorDetails'));
const FamilyDetails = lazy(() => import('./Employee/Additional details/FamilyDetails'));
const JobDetails = lazy(() => import('./Employee/Additional details/JobDetails'));
const FinancialDetails = lazy(() => import('./Employee/Profile details/FinancialDetails'));
const ViewProfile = lazy(() => import('./Employee/Profile details/ViewProfile'));
const EmployeePayroll = lazy(() => import('./Employee/Payroll/EmployeePayroll'));
const Leave = lazy(() => import('./Employee/Leave/LeaveApplication'));
const MyLeavePage = lazy(() => import('./Employee/Leave/MyLeave'));
const AttendanceStats = lazy(() => import('./Employee/Attendance/AttendanceStats'));
const EmployeeCalendar = lazy(() => import('./Employee/Calendar/EmployeeCalendar'));
const IdCardView = lazy(() => import('./Employee/IdCardView'));
const EmployeeTasks = lazy(() => import('./Employee/Project/EmployeeTasks'));
const EmployeeProjects = lazy(() => import('./Employee/Project/EmployeeProjects'));

// Lazy load shared components
const AttendanceDashboard = lazy(() => import('./Both/AttendanceDashboard'));
const ForgotPasswordEmail = lazy(() => import('./Both/ForgotPasswordEmail'));
const ResetPassword = lazy(() => import('./Both/ResetPassword'));
const Notifications = lazy(() => import('./Both/Notifications'));
const DailyReport = lazy(() => import('./Others/DailyReport'));
const NotFound = lazy(() => import('./Others/NotFound'));

function App() {
    const location = useLocation();
    const hideHeaderRoutes = ['/', '/login', '/register', '/organization/register', '/organization/login', '/forgot-password']; // Routes where Header and Sidebar should not be shown
    const showSidebarRoutes = [
        '/profile-details',
        '/contact-details',
        '/next-of-kin-details',
        '/education-qualifications',
        '/guarantor-details',
        '/family-details',
        '/job-details',
        '/financial-details',
    ]; // Routes where ProfileSidebar should be shown

    const [activeSection, setActiveSection] = useState('Personal Details'); // Track active section

    const shouldHideLayout = hideHeaderRoutes.includes(location.pathname);
    const shouldShowSidebar = showSidebarRoutes.includes(location.pathname);
    
    return (
        <div className="min-h-screen bg-gray-100">
            {!shouldHideLayout && <Header />} {/* Conditionally render Header */}
            <InstallPrompt /> {/* PWA Install Prompt */}
            {shouldHideLayout ? (
                // Full-screen layout for auth pages (no header, no sidebar, no flex container)
                <Routes>
                    <Route 
                        path="/" 
                        element={createLazyRoute(Login, "Loading login...")} 
                    />
                    <Route 
                        path="/organization/register" 
                        element={createLazyRoute(OrganizationRegister, "Loading organization registration...")} 
                    />
                    <Route 
                        path="/organization/login" 
                        element={createLazyRoute(OrganizationLogin, "Loading organization login...")} 
                    />
                    {/* Registration route - only available in development or if explicitly enabled */}
                    {(import.meta.env.MODE === 'development' || import.meta.env.VITE_ALLOW_REGISTRATION === 'true') && (
                        <Route 
                            path="/register" 
                            element={createLazyRoute(Register, "Loading registration...")} 
                        />
                    )}
                    <Route 
                        path="/login" 
                        element={createLazyRoute(Login, "Loading login...")} 
                    />
                    <Route 
                        path="/forgot-password" 
                        element={createLazyRoute(ForgotPasswordEmail, "Loading...")} 
                    />
                    <Route 
                        path="/reset-password/:token" 
                        element={createLazyRoute(ResetPassword, "Loading password reset...")} 
                    />
                </Routes>
            ) : (
                // Standard layout with sidebar for other pages
                <div className="flex min-h-[calc(100vh-64px)]">
                    {shouldShowSidebar && (
                        <div className="w-64 bg-white shadow-sm">
                            <ProfileSidebar
                                activeSection={activeSection} // Pass active section
                                onSectionClick={setActiveSection} // Update active section
                            />
                        </div>
                    )}
                    <div className="flex-1 overflow-auto">
                        <Routes>
                            <Route path="/dashboard" element={createLazyRoute(RoleBasedDashboard, "Loading dashboard...")} />
                            <Route path="/dashboard-admin" element={createLazyRoute(DashboardAdmin, "Loading admin dashboard...")} />
                            <Route path="/dashboard-employee" element={createLazyRoute(DashboardEmployee, "Loading employee dashboard...")} />
                            <Route path="/dashboard-hr" element={createLazyRoute(DashboardHR, "Loading HR dashboard...")} />
                            <Route path="/dashboard-manager" element={createLazyRoute(DashboardManager, "Loading manager dashboard...")} />
                            <Route path="/dashboard-finance" element={createLazyRoute(DashboardFinance, "Loading finance dashboard...")} />
                            <Route path="/dashboard-executive" element={createLazyRoute(DashboardExecutive, "Loading executive dashboard...")} />
                            <Route path="/add" element={createLazyRoute(AddEmployee, "Loading...")} />
                            <Route path="/employees" element={createLazyRoute(EmployeesPage, "Loading employees...")} />
                            <Route path="/add-employee" element={createLazyRoute(AddEmployee, "Loading...")} />
                            <Route path="/add-project" element={createLazyRoute(AddProject, "Loading...")} />
                            <Route path="/projects" element={createLazyRoute(ProjectsPage, "Loading projects...")} />
                            <Route path="/projects/:id" element={createLazyRoute(ProjectDetailPage, "Loading project details...")} />
                            <Route path="/view-profile" element={createLazyRoute(ViewProfile, "Loading profile...")} />
                            <Route path="/employees/:employeeId" element={createLazyRoute(EmployeeDetailsPage, "Loading employee details...")} />
                            <Route path="/contact-details" element={createLazyRoute(ContactDetails, "Loading contact details...")} />
                            <Route path="/profile-details" element={createLazyRoute(ProfileDetails, "Loading profile details...")} />
                            <Route path="/next-of-kin-details" element={createLazyRoute(NextOfKinDetails, "Loading...")} />
                            <Route path="/education-qualifications" element={createLazyRoute(EducationQualifications, "Loading...")} />
                            <Route path="/guarantor-details" element={createLazyRoute(GuarantorDetails, "Loading...")} />
                            <Route path="/family-details" element={createLazyRoute(FamilyDetails, "Loading...")} />
                            <Route path="/job-details" element={createLazyRoute(JobDetails, "Loading...")} />
                            <Route path="/financial-details" element={createLazyRoute(FinancialDetails, "Loading...")} />
                            <Route path="/leave" element={createLazyRoute(Leave, "Loading leave application...")} />
                            <Route path="/my-leave" element={createLazyRoute(MyLeavePage, "Loading leave history...")} />
                            <Route path="/attendance-stats" element={createLazyRoute(AttendanceStats, "Loading attendance stats...")} />
                            <Route path="/leave-management" element={createLazyRoute(LeaveManagement, "Loading leave management...")} />
                            <Route path="/daily-report" element={createLazyRoute(DailyReport, "Loading daily report...")} />
                            <Route path="/attendance" element={createLazyRoute(AttendanceDashboard, "Loading attendance...")} />
                            <Route path="/employee-payroll" element={createLazyRoute(EmployeePayroll, "Loading payroll...")} />
                            <Route path="/admin-payroll" element={createLazyRoute(AdminPayroll, "Loading admin payroll...")} />
                            <Route path="/admin-employee-payroll/:employeeId" element={createLazyRoute(AdminEmployeePayroll, "Loading employee payroll...")} />
                            <Route path="/add-payroll" element={createLazyRoute(AddPayroll, "Loading...")} />
                            <Route path="/add-payroll/:employeeId/:month/:year" element={createLazyRoute(UpdatePayroll, "Loading payroll update...")} />
                            <Route path="/today-attendance" element={createLazyRoute(TodayStatusComponent, "Loading today's attendance...")} />
                            <Route path="/all-attendance-history" element={createLazyRoute(AllAttendanceStatsComponent, "Loading attendance history...")} />
                            <Route path="/employee/projects" element={createLazyRoute(EmployeeProjects, "Loading projects...")} />
                            <Route path="/employee/projects/:projectId" element={createLazyRoute(EmployeeTasks, "Loading tasks...")} />
                            <Route path="/employee/calendar" element={createLazyRoute(EmployeeCalendar, "Loading calendar...")} />
                            <Route path="/employee/id-card" element={createLazyRoute(IdCardView, "Loading ID card...")} />
                            <Route path="/notifications" element={createLazyRoute(Notifications, "Loading notifications...")} />
                            <Route path="/role-hierarchy" element={createLazyRoute(RoleHierarchy, "Loading role hierarchy...")} />
                            <Route path="/calendar-management" element={createLazyRoute(CalendarManagement, "Loading calendar management...")} />
                            <Route path="/id-card-generator" element={createLazyRoute(IdCardGenerator, "Loading ID card generator...")} />
                            <Route path="/salary-structure" element={createLazyRoute(SalaryStructureManager, "Loading salary structure...")} />
                            <Route path="/attendance-rules" element={createLazyRoute(AttendanceRules, "Loading attendance rules...")} />
                            <Route path="/admin-settings" element={createLazyRoute(AdminSettings, "Loading admin settings...")} />
                            <Route path="/organization/profile" element={createLazyRoute(OrganizationProfile, "Loading organization profile...")} />
                            <Route path="/organization/dashboard" element={createLazyRoute(OrganizationDashboard, "Loading organization dashboard...")} />
                            <Route path="/organization/settings" element={createLazyRoute(OrganizationSettings, "Loading organization settings...")} />
                            <Route path="/organization/onboarding" element={createLazyRoute(OrganizationOnboarding, "Loading onboarding...")} />
                            <Route path="/organization/subscription" element={createLazyRoute(SubscriptionManagement, "Loading subscription...")} />
                            <Route path="/organization/verification" element={createLazyRoute(OrganizationVerification, "Loading verification...")} />
                            <Route path="/organization/analytics" element={createLazyRoute(OrganizationAnalytics, "Loading analytics...")} />
                            <Route path="/organization/referrals" element={createLazyRoute(ReferralProgram, "Loading referrals...")} />
                            <Route path="/organization/domain" element={createLazyRoute(DomainVerification, "Loading domain verification...")} />
                            <Route path="/admin/policies" element={createLazyRoute(PolicyManager, "Loading policies...")} />
                            <Route path="/admin/policies/create" element={createLazyRoute(CreatePolicy, "Loading create policy...")} />
                            <Route path="/employee/policies" element={createLazyRoute(ViewPolicies, "Loading policies...")} />
                            <Route path="*" element={createLazyRoute(NotFound, "Loading...")} />
                        </Routes>
                    </div>
                </div>
            )}
        </div>
    );
}

function AppWrapper() {
    return (
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <App />
        </Router>
    );
}

export default AppWrapper;
