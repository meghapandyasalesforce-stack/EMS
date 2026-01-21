import Employee from "../../models/employee.model.js"
import Leave from "../../models/leave.model.js"
import logger from "../../helpers/logger.js";
import { sendSuccess, sendError, sendNotFound, sendUnauthorized, sendInternalError } from "../../helpers/responseHelper.js";


// Create a leave request
export const createLeave = async (req, res) => {
    logger.debug("Creating leave request", { employeeId: req.employee?._id });

    try {
        const { startDate, endDate, leaveType, reason } = req.body;
        const employeeId = req.employee?._id;

        // ✅ Ensure authentication was successful
        if (!employeeId) {
            return sendUnauthorized(res, "Unauthorized: Employee data missing");
        }

        // ✅ Validate required fields
        if (!startDate || !endDate || isNaN(new Date(startDate)) || isNaN(new Date(endDate))) {
            return sendError(res, "Invalid start or end date format", 400, 'INVALID_DATE_FORMAT');
        }

        if (new Date(endDate) < new Date(startDate)) {
            return sendError(res, "End date cannot be before start date", 400, 'INVALID_DATE_RANGE');
        }

        const employee = await Employee.findById(employeeId);
        logger.debug("Employee found", { employeeId, hasEmployee: !!employee });

        if (!employee) {
            return sendNotFound(res, "Employee");
        }

        // Get organizationId - required for multi-tenancy
        const organizationId = req.organizationId || req.employee?.organizationId || req.user?.organizationId || employee.organizationId;
        
        if (!organizationId) {
            logger.error('Create Leave Error: Missing organizationId', {
                employeeId,
                hasEmployee: !!employee,
                hasReqEmployee: !!req.employee,
                hasReqUser: !!req.user
            });
            return sendError(res, 'Organization ID is required. Please ensure you are authenticated.', 400, 'MISSING_ORGANIZATION_ID');
        }

        const duration = Math.max(1, Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1);

        const leave = new Leave({
            organizationId, // Required for multi-tenancy
            employee: employeeId,
            employeeName: `${employee.name} ${employee.lastName}`,
            startDate,
            endDate,
            leaveType,
            reason,
            duration,
            resumptionDate: new Date(endDate),
            year: new Date(startDate).getFullYear(),
            status: "pending"
        });

        await leave.save();
        return sendSuccess(res, { leave }, "Leave application submitted successfully", 201);

    } catch (error) {
        logger.error("Create Leave Error", { error: error.message, stack: error.stack });
        return sendInternalError(res, "Error submitting leave application", error);
    }
};
// Get current user's leaves
export const getMyLeaves = async (req, res) => {
    try {
        const employeeId = req.employee._id;
        const year = new Date().getFullYear();

        const leaves = await Leave.find({ employee: employeeId }).sort({ createdAt: -1 });

        const currentYearLeaves = leaves.filter(leave =>
            new Date(leave.startDate).getFullYear() === year &&
            leave.status === 'approved'
        );

        const statistics = {
            totalLeaves: 36,
            leavesTaken: currentYearLeaves.reduce((acc, leave) => acc + leave.duration, 0),
            leavesByType: {
                sick: currentYearLeaves.filter(l => l.leaveType === 'sick').reduce((acc, l) => acc + l.duration, 0),
                annual: currentYearLeaves.filter(l => l.leaveType === 'annual').reduce((acc, l) => acc + l.duration, 0),
                casual: currentYearLeaves.filter(l => l.leaveType === 'casual').reduce((acc, l) => acc + l.duration, 0)
            }
        };

        statistics.remainingLeaves = statistics.totalLeaves - statistics.leavesTaken;

        res.json({ leaves, statistics });
    } catch (error) {
        logger.error('Get My Leaves Error', { error: error.message, stack: error.stack });
        res.status(500).json({ message: 'Error fetching your leaves', error: error.message });
    }
};

