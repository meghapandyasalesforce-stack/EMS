import leaveBalanceAutomationService from '../../services/leaveBalanceAutomationService.js';
import { buildEmployeeLeaveBalanceResponse } from '../../helpers/leaveBalanceResponseHelper.js';
import { resolveEmployeeLeaveBalanceAccess } from '../../helpers/leaveBalanceAccessHelper.js';
import logger from '../../helpers/logger.js';

function parseMonthYearQuery(query) {
    const year = query.year ? parseInt(query.year, 10) : new Date().getFullYear();
    const month = query.month ? parseInt(query.month, 10) : new Date().getMonth() + 1;
    if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
        return null;
    }
    return { year, month };
}

/**
 * POST /balance/:employeeId/update-leave
 * Body: { fromYear, fromMonth, force?: boolean }
 */
export const updateLeaveFromPeriod = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { fromYear, fromMonth, force = false } = req.body;

        const access = await resolveEmployeeLeaveBalanceAccess(req, employeeId, { forAdjust: true });
        if (!access.ok) {
            return res.status(access.status || 403).json({ success: false, message: access.message });
        }

        const organizationId = access.organizationId;

        if (!fromYear || !fromMonth) {
            return res.status(400).json({
                success: false,
                message: 'fromYear and fromMonth are required (e.g. fromYear: 2023, fromMonth: 1 for January 2023)',
            });
        }

        const performedBy = req.employee?._id || req.user?._id;
        const result = await leaveBalanceAutomationService.updateLeaveFromPeriod(
            employeeId,
            organizationId,
            fromYear,
            fromMonth,
            performedBy,
            { force: Boolean(force) }
        );

        if (result.duplicatePrevented) {
            return res.status(409).json({ success: false, ...result });
        }

        const current = parseMonthYearQuery({});
        const balanceObj = await buildEmployeeLeaveBalanceResponse(
            employeeId,
            current.year,
            organizationId,
            { month: current.month }
        );

        res.json({
            ...result,
            balance: balanceObj,
            canAdjust: true,
        });
    } catch (error) {
        logger.error('Update leave from period error', { error: error.message, stack: error.stack });
        res.status(error.message.includes('not found') ? 404 : 400).json({
            success: false,
            message: error.message,
        });
    }
};

/**
 * POST /balance/:employeeId/carry-forward
 * Body: { fromYear, force?: boolean }
 */
export const carryForwardLeave = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { fromYear, force = false } = req.body;

        const access = await resolveEmployeeLeaveBalanceAccess(req, employeeId, { forAdjust: true });
        if (!access.ok) {
            return res.status(access.status || 403).json({ success: false, message: access.message });
        }

        const organizationId = access.organizationId;

        if (!fromYear) {
            return res.status(400).json({
                success: false,
                message: 'fromYear is required (e.g. 2023 to carry balance into 2024)',
            });
        }

        const performedBy = req.employee?._id || req.user?._id;
        const result = await leaveBalanceAutomationService.executeCarryForward(
            employeeId,
            organizationId,
            fromYear,
            performedBy,
            { force: Boolean(force) }
        );

        if (result.duplicatePrevented) {
            return res.status(409).json({ success: false, ...result });
        }

        const targetYear = Number(fromYear) + 1;
        const balanceObj = await buildEmployeeLeaveBalanceResponse(
            employeeId,
            targetYear,
            organizationId
        );

        res.json({
            ...result,
            balance: balanceObj,
            canAdjust: true,
        });
    } catch (error) {
        logger.error('Carry forward leave error', { error: error.message, stack: error.stack });
        res.status(error.message.includes('not found') ? 404 : 400).json({
            success: false,
            message: error.message,
        });
    }
};

/**
 * GET /balance/:employeeId/audit
 */
export const getLeaveBalanceAuditLog = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);

        const access = await resolveEmployeeLeaveBalanceAccess(req, employeeId, { forAdjust: false });
        if (!access.ok) {
            return res.status(access.status || 403).json({ success: false, message: access.message });
        }

        const organizationId = access.organizationId;

        const auditLog = await leaveBalanceAutomationService.getAuditLog(employeeId, organizationId, limit);

        res.json({ success: true, auditLog });
    } catch (error) {
        logger.error('Get leave audit log error', { error: error.message });
        res.status(500).json({ success: false, message: 'Error fetching audit log' });
    }
};

/**
 * GET balance with month+year view support (extends existing handler via query params).
 */
export const getEmployeeLeaveBalanceWithPeriod = async (req, res, next) => {
    const period = parseMonthYearQuery(req.query);
    if (!period) {
        return res.status(400).json({ success: false, message: 'Invalid year or month' });
    }
    req.leaveBalancePeriod = period;
    return next();
};

export { parseMonthYearQuery };
