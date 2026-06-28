import AttendanceRegularization from '../models/attendanceRegularization.model.js';
import mongoose from 'mongoose';
import { DEFAULT_TIMEZONE } from '../constants/timezoneOptions.js';
import { getActiveAttendanceRule } from './attendanceSecurityHelper.js';
import { getEffectiveTimezone } from './organizationTimezoneService.js';
import {
    getMonthBoundsInTimezone,
    isSameCalendarMonthInTimezone
} from './timezoneHelper.js';

export const DEFAULT_REGULARIZATION_RULES = {
    enabled: true,
    allowedPerMonth: 5
};

export const MAX_REGULARIZATION_PER_MONTH = 31;

const resolveOrganizationTimezone = async (organizationId) => {
    if (!organizationId || !mongoose.isValidObjectId(String(organizationId))) {
        return DEFAULT_TIMEZONE;
    }
    try {
        return await getEffectiveTimezone(organizationId);
    } catch {
        return DEFAULT_TIMEZONE;
    }
};

export const resolveRegularizationRules = (attendanceRule) => ({
    enabled: attendanceRule?.regularizationRules?.enabled !== false,
    allowedPerMonth:
        attendanceRule?.regularizationRules?.allowedPerMonth ??
        DEFAULT_REGULARIZATION_RULES.allowedPerMonth
});

/**
 * Validate and normalize regularization rules from admin API input.
 * @returns {{ enabled: boolean, allowedPerMonth: number } | null}
 * @throws {Error} with statusCode 400 when invalid
 */
export const normalizeRegularizationRulesInput = (regularizationRules) => {
    if (regularizationRules == null) return null;

    const enabled = regularizationRules.enabled !== false;
    const raw = regularizationRules.allowedPerMonth;

    if (raw === undefined || raw === null || raw === '') {
        return {
            enabled,
            allowedPerMonth: DEFAULT_REGULARIZATION_RULES.allowedPerMonth
        };
    }

    const allowedPerMonth = Number(raw);
    if (
        !Number.isFinite(allowedPerMonth) ||
        !Number.isInteger(allowedPerMonth) ||
        allowedPerMonth < 0 ||
        allowedPerMonth > MAX_REGULARIZATION_PER_MONTH
    ) {
        const error = new Error(
            `allowedPerMonth must be an integer from 0 to ${MAX_REGULARIZATION_PER_MONTH} (0 = unlimited)`
        );
        error.statusCode = 400;
        throw error;
    }

    return { enabled, allowedPerMonth };
};

/** @deprecated Use getMonthBoundsInTimezone — kept for tests using local calendar */
export const getMonthBounds = (date = new Date()) => {
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const nextMonthStart = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    return { monthStart, nextMonthStart };
};

export const isRegularizationInCurrentMonth = async (organizationId, attendanceDate) => {
    const timezone = await resolveOrganizationTimezone(organizationId);
    return isSameCalendarMonthInTimezone(
        new Date(attendanceDate),
        new Date(),
        timezone
    );
};

export const countMonthlyRegularizationRequests = async (
    organizationId,
    employeeId,
    referenceDate = new Date()
) => {
    const timezone = await resolveOrganizationTimezone(organizationId);
    const { monthStart, nextMonthStart } = getMonthBoundsInTimezone(referenceDate, timezone);
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
