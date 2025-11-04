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
  forceEndBreak
} from '../../controllers/attendance/attendanceController.js';

import isAuthenticated from '../../middlewares/isAuthenticated.js';
import isAdminAuthenticated from '../../middlewares/isAdminAuthenticated.js';

const router = express.Router();

// Employee actions
router.route("/clock-in").post(isAuthenticated, clockIn);
router.route("/break-in").post(isAuthenticated, breakIn);
router.route("/break-out").post(isAuthenticated, breakOut);
router.route("/clock-out").post(isAuthenticated, clockOut);
router.route("/force-end-break").post(isAuthenticated, forceEndBreak); // Forced break end
router.route("/get-logs").get(isAuthenticated, getLogs);

// Employee data endpoints
router.route("/all-employee-list")
  .get(isAdminAuthenticated, getEmployeeList); // Get list of all employees

router.route("/employee/:employeeId/attendance")
  .get(isAdminAuthenticated, getEmployeeAttendanceDetails); // Get specific employee attendance

// Admin-only endpoints
router.route("/today-status").get(isAdminAuthenticated, getTodayStatus);

// Employee-only helper endpoint
router.route("/my-today-status").get(isAuthenticated, getMyTodayStatus);

export default router;

