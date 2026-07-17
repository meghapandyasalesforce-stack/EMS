/**
 * Route configuration
 * Centralized route registration for better maintainability
 */

import organizationAuthRouter from "../routes/Auth/OrganizationRoutes.js";
import adminRouter from "../routes/Auth/AdminRoutes.js";
import employeeRouter from "../routes/Auth/EmployeeRoutes.js";
import leaveEmployeeRouter from "../routes/Employee/LeaveEmployeeRoutes.js";
import leaveAdminRouter from "../routes/Admin/LeaveAdminRoutes.js";
import leavePolicyRouter from "../routes/Admin/LeavePolicyRoutes.js";
import leaveEncashmentRouter from "../routes/Employee/LeaveEncashmentRoutes.js";
import leaveReportsRouter from "../routes/Admin/LeaveReportsRoutes.js";
import projectRouter from "../routes/Admin/ProjectsRoutes.js";
import attendanceRouter from "../routes/Both/AttendanceRoutes.js";
import organizationTimezoneRouter from "../routes/Both/OrganizationTimezoneRoutes.js";
import attendanceRegularizationRouter from "../routes/Both/AttendanceRegularizationRoutes.js";
import wfhRequestRouter from "../routes/Both/WfhRequestRoutes.js";
import payrollRouter from "../routes/Admin/PayrollRoutes.js";
import profileDetailsRouter from "../routes/Employee/ProfileDetailsRoutes.js";
import employeeCalendarRouter from "../routes/Employee/EmployeeCalendarRoutes.js";
import employeePayrollRouter from "../routes/Employee/EmployeePayrollRoutes.js";
import employeeDataRouter from "../routes/Employee/EmployeeRoutes.js";
import notificationRouter from "../routes/Admin/NotificationRoutes.js";
import pushSubscriptionRouter from "../routes/Admin/PushSubscriptionRoutes.js";
import uploadRouter from "../routes/Both/UploadRoutes.js";
import forgotPasswordRouter from "../routes/Both/ForgotPasswordRoutes.js";
import unifiedAuthRouter from "../routes/Both/UnifiedAuthRoutes.js";
import taskRouter from "../routes/Both/TaskRoutes.js";
import profilePhotoRouter from "../routes/Both/ProfilePhotoRoutes.js";
import emailTestRouter from "../routes/Both/EmailTestRoutes.js";
import roleRouter from "../routes/Admin/RoleRoutes.js";
import calendarRouter from "../routes/Admin/CalendarRoutes.js";
import idCardRouter from "../routes/Admin/IdCardRoutes.js";
import salaryStructureRouter from "../routes/Admin/SalaryStructureRoutes.js";
import employeeAdminRouter from "../routes/Admin/EmployeeRoutes.js";
import attendanceRuleRouter from "../routes/Admin/AttendanceRuleRoutes.js";
import notificationSettingsRouter from "../routes/Admin/NotificationSettingsRoutes.js";
import expenseRouter from "../routes/Both/ExpenseRoutes.js";
import reportRouter from "../routes/Admin/ReportRoutes.js";
import performanceReviewRouter from "../routes/Both/PerformanceReviewRoutes.js";
import performanceTrackingRouter from "../routes/Both/PerformanceTrackingRoutes.js";
import reviewCycleRouter from "../routes/Admin/ReviewCycleRoutes.js";
import goalRouter from "../routes/Both/GoalRoutes.js";
import organizationRouter from "../routes/Admin/OrganizationRoutes.js";
import subscriptionRouter from "../routes/Organization/SubscriptionRoutes.js";
import policyRouter from "../routes/Organization/PolicyRoutes.js";
import dashboardRouter from "../routes/Organization/DashboardRoutes.js";
import healthRouter from "../routes/Health/healthRoutes.js";
// New HR & Manager Features
import recruitmentAdminRouter from "../routes/Admin/RecruitmentRoutes.js";
import recruitmentBothRouter from "../routes/Both/RecruitmentRoutes.js";
import onboardingRouter from "../routes/Admin/OnboardingRoutes.js";
import onboardingBothRouter from "../routes/Both/OnboardingRoutes.js";
import learningBothRouter from "../routes/Both/LearningRoutes.js";
import learningAdminRouter from "../routes/Admin/LearningRoutes.js";
import engagementBothRouter from "../routes/Both/EngagementRoutes.js";
import engagementAdminRouter from "../routes/Admin/EngagementRoutes.js";
import documentBothRouter from "../routes/Both/DocumentRoutes.js";
import documentAdminRouter from "../routes/Admin/DocumentRoutes.js";
import benefitsBothRouter from "../routes/Both/BenefitsRoutes.js";
import benefitsAdminRouter from "../routes/Admin/BenefitsRoutes.js";
import successionRouter from "../routes/Admin/SuccessionRoutes.js";
import workforceRouter from "../routes/Admin/WorkforceRoutes.js";
import helpdeskRouter from "../routes/Both/HelpdeskRoutes.js";
import oneOnOneRouter from "../routes/Both/OneOnOneRoutes.js";
import teamLearningRouter from "../routes/Both/TeamLearningRoutes.js";
import analyticsRouter from "../routes/Admin/AnalyticsRoutes.js";
import executiveRouter from "../routes/Executive/ExecutiveRoutes.js";
import approvalWorkflowRouter from "../routes/Admin/ApprovalWorkflowRoutes.js";
import slaRouter from "../routes/Admin/SLARoutes.js";
import compOffRouter from "../routes/Both/CompOffRoutes.js";
import compOffAdminRouter from "../routes/Admin/CompOffAdminRoutes.js";
import payrollReportsRouter from "../routes/Admin/PayrollReportsRoutes.js";
import auditLogRouter from "../routes/Admin/AuditLogRoutes.js";
import platformRolesRouter from "../routes/Admin/PlatformRolesRoutes.js";

import { setCacheHeaders } from "../middlewares/cacheHeaders.js";

/**
 * Register all application routes
 * @param {Express} app - Express application instance
 */
export const registerRoutes = (app) => {
  // Health check routes (public - for monitoring)
  app.use("/api/health", healthRouter);
  
  // Organization routes (public - for registration and login)
  app.use("/api/v1/organization/auth", organizationAuthRouter);
  app.use("/api/v1/organization/subscription", subscriptionRouter);
  app.use("/api/v1/organization/policies", policyRouter);
  app.use("/api/v1/organization/dashboard", dashboardRouter);
  
  // Admin routes
  app.use("/api/v1/admin/auth", adminRouter);
  app.use("/api/v1/admin/leave", leaveAdminRouter);
  app.use("/api/v1/admin/leave-policy", leavePolicyRouter);
  app.use("/api/v1/admin/leave-encashment", leaveEncashmentRouter);
  app.use("/api/v1/admin/leave-reports", leaveReportsRouter);
  app.use("/api/v1/admin/project", projectRouter);
  app.use("/api/v1/admin/payroll", payrollRouter);
  app.use("/api/v1/admin/employee", employeeAdminRouter);
  app.use("/api/v1/admin/audit-logs", auditLogRouter);
  app.use("/api/v1/admin/roles", roleRouter);
  app.use("/api/v1/admin/platform-roles", platformRolesRouter);
  app.use("/api/v1/admin/calendar", calendarRouter);
  app.use("/api/v1/admin/id-cards", idCardRouter);
  app.use("/api/v1/admin/salary-structure", salaryStructureRouter);
  app.use("/api/v1/admin/attendance-rules", attendanceRuleRouter);
  app.use("/api/v1/admin/notification-settings", notificationSettingsRouter);
  app.use("/api/v1/admin/reports", reportRouter);
  app.use("/api/v1/admin/organization", organizationRouter);
  app.use("/api/v1/admin/review-cycle", reviewCycleRouter);

  // Employee routes (register specific routes first to avoid conflicts)
  app.use("/api/v1/employee/auth", employeeRouter);
  app.use("/api/v1/employee/leave", leaveEmployeeRouter);
  app.use("/api/v1/employee/leave-encashment", leaveEncashmentRouter);
  app.use("/api/v1/employee/calendar", employeeCalendarRouter);
  app.use("/api/v1/employee/payroll", employeePayrollRouter);
  // Register general employee routes last (after all specific routes)
  app.use("/api/v1/employee", employeeDataRouter);

  // Shared routes (both admin and employee)
  app.use("/api/v1/both/attendance", attendanceRouter);
  app.use("/api/v1/both/organization-timezone", organizationTimezoneRouter);
  app.use("/api/v1/both/attendance-regularization", attendanceRegularizationRouter);
  app.use("/api/v1/both/wfh-requests", wfhRequestRouter);
  app.use("/api/v1/both/notification", notificationRouter);
  app.use("/api/v1/both/push-subscription", pushSubscriptionRouter);
  app.use("/api/v1/both/profile-details", profileDetailsRouter);
  app.use("/api/v1/both/document", uploadRouter);
  // Alias for legacy clients expecting /api/v1/upload/... download paths
  app.use("/api/v1/upload", uploadRouter);
  app.use("/api/v1/both/password", forgotPasswordRouter);
  app.use("/api/v1/both/auth", unifiedAuthRouter);
  app.use("/api/v1/both/project-task", taskRouter);
  app.use("/api/v1/both/profile-photo", profilePhotoRouter);
  app.use("/api/v1/both/email", emailTestRouter);
  app.use("/api/v1/both/expense", expenseRouter);
  app.use("/api/v1/both/performance-review", performanceReviewRouter);
  app.use("/api/v1/both/performance-tracking", performanceTrackingRouter);
  app.use("/api/v1/both/goal", goalRouter);
  
  // New HR & Manager Features - Shared Routes
  app.use("/api/v1/both/recruitment", recruitmentBothRouter);
  app.use("/api/v1/both/onboarding", onboardingBothRouter);
  app.use("/api/v1/both/learning", learningBothRouter);
  app.use("/api/v1/both/engagement", engagementBothRouter);
  app.use("/api/v1/both/documents", documentBothRouter);
  app.use("/api/v1/both/benefits", benefitsBothRouter);
  app.use("/api/v1/both/helpdesk", helpdeskRouter);
  app.use("/api/v1/both/one-on-one", oneOnOneRouter);
  app.use("/api/v1/both/team-learning", teamLearningRouter);
  
  // New HR & Manager Features - Admin Only Routes
  app.use("/api/v1/admin/recruitment", recruitmentAdminRouter);
  app.use("/api/v1/admin/onboarding", onboardingRouter);
  app.use("/api/v1/admin/comp-off", compOffAdminRouter);
  app.use("/api/v1/admin/payroll-reports", payrollReportsRouter);
  app.use("/api/v1/admin/learning", learningAdminRouter);
  app.use("/api/v1/admin/engagement", engagementAdminRouter);
  app.use("/api/v1/admin/documents", documentAdminRouter);
  app.use("/api/v1/admin/benefits", benefitsAdminRouter);
  app.use("/api/v1/admin/succession", successionRouter);
  app.use("/api/v1/admin/workforce", workforceRouter);
  app.use("/api/v1/admin/analytics", analyticsRouter);
  app.use("/api/v1/admin/executive", executiveRouter);
  app.use("/api/v1/admin/approvals", approvalWorkflowRouter);
  app.use("/api/v1/admin/sla", slaRouter);
};

