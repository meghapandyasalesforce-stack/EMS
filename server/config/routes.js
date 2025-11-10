/**
 * Route configuration
 * Centralized route registration for better maintainability
 */

import adminRouter from "../routes/Auth/AdminRoutes.js";
import employeeRouter from "../routes/Auth/EmployeeRoutes.js";
import leaveEmployeeRouter from "../routes/Employee/LeaveEmployeeRoutes.js";
import leaveAdminRouter from "../routes/Admin/LeaveAdminRoutes.js";
import projectRouter from "../routes/Admin/ProjectsRoutes.js";
import attendanceRouter from "../routes/Both/AttendanceRoutes.js";
import payrollRouter from "../routes/Admin/PayrollRoutes.js";
import profileDetailsRouter from "../routes/Employee/ProfileDetailsRoutes.js";
import employeeCalendarRouter from "../routes/Employee/EmployeeCalendarRoutes.js";
import employeePayrollRouter from "../routes/Employee/EmployeePayrollRoutes.js";
import notificationRouter from "../routes/Admin/NotificationRoutes.js";
import pushSubscriptionRouter from "../routes/Admin/PushSubscriptionRoutes.js";
import uploadRouter from "../routes/Both/UploadRoutes.js";
import forgotPasswordRouter from "../routes/Both/ForgotPasswordRoutes.js";
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

/**
 * Register all application routes
 * @param {Express} app - Express application instance
 */
export const registerRoutes = (app) => {
  // Admin routes
  app.use("/api/v1/admin/auth", adminRouter);
  app.use("/api/v1/admin/leave", leaveAdminRouter);
  app.use("/api/v1/admin/project", projectRouter);
  app.use("/api/v1/admin/payroll", payrollRouter);
  app.use("/api/v1/admin/employee", employeeAdminRouter);
  app.use("/api/v1/admin/roles", roleRouter);
  app.use("/api/v1/admin/calendar", calendarRouter);
  app.use("/api/v1/admin/id-cards", idCardRouter);
  app.use("/api/v1/admin/salary-structure", salaryStructureRouter);
  app.use("/api/v1/admin/attendance-rules", attendanceRuleRouter);
  app.use("/api/v1/admin/notification-settings", notificationSettingsRouter);

  // Employee routes
  app.use("/api/v1/employee/auth", employeeRouter);
  app.use("/api/v1/employee/leave", leaveEmployeeRouter);
  app.use("/api/v1/employee/calendar", employeeCalendarRouter);
  app.use("/api/v1/employee/payroll", employeePayrollRouter);

  // Shared routes (both admin and employee)
  app.use("/api/v1/both/attendance", attendanceRouter);
  app.use("/api/v1/both/notification", notificationRouter);
  app.use("/api/v1/both/notification", pushSubscriptionRouter);
  app.use("/api/v1/both/profile-details", profileDetailsRouter);
  app.use("/api/v1/both/document", uploadRouter);
  app.use("/api/v1/both/password", forgotPasswordRouter);
  app.use("/api/v1/both/project-task", taskRouter);
  app.use("/api/v1/both/profile-photo", profilePhotoRouter);
  app.use("/api/v1/both/email", emailTestRouter);
};

