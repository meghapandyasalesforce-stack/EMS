import express from 'express';
import {
  clockIn,
  breakIn,
  breakOut,
  clockOut,
  getLogs,
  getTodayStatus,
  getMyTodayStatus,
  getEmployeeList,
  getEmployeeAttendanceDetails,
  getTeamAttendanceHistory,
  forceEndBreak,
  getEmployeesOnBreak,
  getAttendanceSummary,
  getAttendanceRuleForEmployee
} from '../../controllers/attendance/attendanceController.js';
import { exportAttendancePDF } from '../../controllers/admin/pdfExportController.js';
import isAuthenticated from '../../middlewares/isAuthenticated.js';
import isAdminAuthenticated from '../../middlewares/isAdminAuthenticated.js';
import isAdminOrManagerOrHRAuthenticated from '../../middlewares/isAdminOrManagerOrHRAuthenticated.js';
import { isAuthenticatedBoth } from '../../middlewares/isAuthenticatedBoth.js';
import { cacheMiddleware } from '../../helpers/cache.js';
import { exportLimiter } from '../../middlewares/endpointRateLimiters.js';
import { attendanceCheckInLimiter, attendanceCheckOutLimiter, attendanceRadiusCheckLimiter } from '../../middlewares/rateLimiter.js';
import { attendanceValidations } from '../../middlewares/inputValidation.js';

const router = express.Router();

// Employee actions (no caching - write operations)
router.route("/clock-in").post(
  isAuthenticated, 
  attendanceCheckInLimiter, 
  ...attendanceValidations.clockIn,
  clockIn
);
router.route("/break-in").post(isAuthenticated, breakIn);
router.route("/break-out").post(isAuthenticated, breakOut);
router.route("/clock-out").post(isAuthenticated, attendanceCheckOutLimiter, clockOut);
router.route("/force-end-break").post(isAuthenticated, forceEndBreak); // Forced break end
// Cache attendance logs for 1 minute (frequently changing data)
router.route("/get-logs").get(isAuthenticated, cacheMiddleware('attendance:logs', 60), getLogs);

// Attendance summary (both admin and employee) - cache for 2 minutes
router.route("/summary").get(isAuthenticatedBoth, cacheMiddleware('attendance:summary', 120), getAttendanceSummary);

// Employee data endpoints
// Allow managers to view employees in their department - cache for 5 minutes
router.route("/all-employee-list")
  .get(isAdminOrManagerOrHRAuthenticated, cacheMiddleware('attendance:employee-list', 300), getEmployeeList);

// Allow managers to view attendance for employees in their department - cache for 2 minutes
router.route("/employee/:employeeId/attendance")
  .get(isAdminOrManagerOrHRAuthenticated, cacheMiddleware('attendance:employee', 120), getEmployeeAttendanceDetails);

router.route("/team-attendance-history").get(isAdminOrManagerOrHRAuthenticated, getTeamAttendanceHistory);

// Allow managers to view today's attendance for their department - cache for 1 minute (real-time data)
router.route("/today-status").get(isAdminOrManagerOrHRAuthenticated, cacheMiddleware('attendance:today', 60), getTodayStatus);
router.route("/employees-on-break").get(isAdminOrManagerOrHRAuthenticated, cacheMiddleware('attendance:on-break', 60), getEmployeesOnBreak);

// Employee-only helper endpoint - cache for 1 minute
router.route("/my-today-status").get(isAuthenticated, cacheMiddleware('attendance:my-today', 60), getMyTodayStatus);

// Get attendance rule for employees (location, radius, daySchedule half/WFH locks).
// Do not cache: daySchedule.currentHalf / lockWfhOnly change through the day.
router.route("/rule").get(isAuthenticatedBoth, getAttendanceRuleForEmployee);

// PDF Export route
router.route("/:employeeId/export-pdf")
    .get(isAuthenticated, exportLimiter, exportAttendancePDF);

export default router;

