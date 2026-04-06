import express from "express";
import { getAllLeaves, getLeaveStatistics, updateLeaveStatus } from "../../controllers/leave/leaveAdminController.js";
import isAdminAuthenticated from "../../middlewares/isAdminAuthenticated.js";
import isAdminOrManagerOrHRAuthenticated from "../../middlewares/isAdminOrManagerOrHRAuthenticated.js";
import { leaveLimiter } from "../../middlewares/endpointRateLimiters.js";
import { writeLimiter } from "../../middlewares/rateLimiter.js";

const router = express.Router();
 
// Get all leaves - with rate limiting
// Allow HR and Managers to access this endpoint for managing leave requests
// Managers will see leaves for their department only
router.route("/get-all-leaves")
    .get(isAdminOrManagerOrHRAuthenticated, leaveLimiter, getAllLeaves);

// Update leave status - write operation with stricter limits
// Allow HR and Managers to approve/reject leave requests
// Managers can only approve/reject leaves for their department
router.route("/update-leave-status/:id")
    .put(isAdminOrManagerOrHRAuthenticated, writeLimiter, updateLeaveStatus);

// Get leave statistics - moderate rate limiting
router.route("/get-leave-statistics/:employeeId")
    .get(isAdminAuthenticated, leaveLimiter, getLeaveStatistics);




export default router;