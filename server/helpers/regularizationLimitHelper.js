import AttendanceRegularization from '../models/attendanceRegularization.model.js';
import { getActiveAttendanceRule } from './attendanceSecurityHelper.js';

export const DEFAULT_REGULARIZATION_RULES = {
    enabled: true,
    allowedPerMonth: 5
};

export const resolveRegularizationRules = (attendanceRule) => ({
    enabled: attendanceRule?.regularizationRules?.enabled !== false,
    allowedPerMonth:
        attendanceRule?.regularizationRules?.allowedPerMonth ??
        DEFAULT_REGULARIZATION_RULES.allowedPerMonth
});

export const getMonthBounds = (date = new Date()) => {
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const nextMonthStart = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    return { monthStart, nextMonthStart };
};

export const countMonthlyRegularizationRequests = async (
    organizationId,
    employeeId,
    referenceDate = new Date()
) => {
    const { monthStart, nextMonthStart } = getMonthBounds(referenceDate);
    return AttendanceRegularization.countDocuments({
        organizationId,
        employeeId,
        attendanceDate: { $gte: monthStart, $lt: nextMonthStart },
        status: { $in: ['pending', 'approved'] }
    });
};

export const getRegularizationLimitSummary = async (organizationId, employeeId, employee = null) => {
    const rule = await getActiveAttendanceRule(organizationId, employee);
    const { enabled, allowedPerMonth } = resolveRegularizationRules(rule);
    const usedThisMonth = await countMonthlyRegularizationRequests(
        organizationId,
        employeeId
    );
    const unlimited = allowedPerMonth === 0;
    const remaining = unlimited ? null : Math.max(allowedPerMonth - usedThisMonth, 0);

    return {
        enabled,
        allowedPerMonth,
        unlimited,
        usedThisMonth,
        remaining,
        canSubmit: enabled && (unlimited || usedThisMonth < allowedPerMonth)
    };
};
