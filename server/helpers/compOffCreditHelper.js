/**
 * Comp-off credit rules.
 * 4 approved hours become half a day. 8 become one full day. Remainder stays as hours.
 * Half-day and full-day requests grant leave immediately and do not enter this hour bank.
 */

import CompOff from '../models/compOff.model.js';
import Leave from '../models/leave.model.js';
import LeaveBalance from '../models/leaveBalance.model.js';
import { roundLeaveDays } from './leaveBalanceRulesHelper.js';
import logger from './logger.js';

export const COMP_OFF_HALF_DAY_HOURS = 4;
export const COMP_OFF_FULL_DAY_HOURS = 8;

export function hoursBetween(startTime, endTime) {
    const start = parseHm(startTime);
    const end = parseHm(endTime);
    if (start == null || end == null || end === start) return 0;
    // An earlier end time is the next morning, still credited to the start date.
    const span = end > start ? end - start : end + 24 * 60 - start;
    return Math.round((span / 60) * 100) / 100;
}

export function creditFromHourTotal(totalHours) {
    const total = Math.max(0, Number(totalHours) || 0);
    const fullDays = Math.floor(total / COMP_OFF_FULL_DAY_HOURS);
    const afterFull = total - fullDays * COMP_OFF_FULL_DAY_HOURS;
    const halfDays = afterFull >= COMP_OFF_HALF_DAY_HOURS ? 0.5 : 0;
    const consumeHours = fullDays * COMP_OFF_FULL_DAY_HOURS + (halfDays ? COMP_OFF_HALF_DAY_HOURS : 0);
    return {
        creditDays: fullDays + halfDays,
        consumeHours,
    };
}

/**
 * Add compensatory leave days to the employee balance.
 * Stored as manual stock so a later balance recalculation keeps the credit.
 */
export async function creditCompensatoryDays({ employeeId, organizationId, days, reason }) {
    const amount = roundLeaveDays(Number(days) || 0);
    if (amount <= 0) return { credited: false, days: 0 };

    const year = new Date().getFullYear();
    let balance = await LeaveBalance.findOne({ organizationId, employee: employeeId, year });
    if (!balance) {
        balance = await LeaveBalance.findOne({ organizationId, employee: employeeId }).sort({ year: -1 });
    }
    if (!balance) {
        logger.warn('Comp-off approved but no leave balance to credit', { employeeId, organizationId, days: amount });
        return { credited: false, days: amount, reason: 'NO_LEAVE_BALANCE' };
    }

    let row = balance.balances.find((b) => b.leaveType === 'compensatory');
    if (!row) {
        balance.balances.push({
            leaveType: 'compensatory',
            accrued: amount,
            used: 0,
            available: amount,
            carriedForward: 0,
            expired: 0,
            pending: 0,
            manualStock: amount,
            manualDebit: 0,
            manualOverride: {
                active: true,
                manualStock: amount,
                manualDebit: 0,
                reason: reason || 'Comp-off approval',
                adjustedAt: new Date(),
            },
        });
    } else {
        const previous = row.manualOverride?.active
            ? Number(row.manualOverride.manualStock) || Number(row.manualStock) || 0
            : Number(row.manualStock) || 0;
        const nextStock = roundLeaveDays(previous + amount);
        row.manualStock = nextStock;
        row.available = roundLeaveDays((Number(row.available) || 0) + amount);
        row.accrued = roundLeaveDays((Number(row.accrued) || 0) + amount);
        row.manualOverride = {
            ...(row.manualOverride?.toObject ? row.manualOverride.toObject() : row.manualOverride || {}),
            active: true,
            manualStock: nextStock,
            manualDebit: Number(row.manualDebit) || Number(row.manualOverride?.manualDebit) || 0,
            reason: reason || row.manualOverride?.reason || 'Comp-off approval',
            adjustedAt: new Date(),
        };
    }

    balance.markModified('balances');
    await balance.save();
    return { credited: true, days: amount };
}

/**
 * Turn a bank of approved hour-requests into half and full compensatory days.
 */
export async function settleApprovedCompOffHours({ employeeId, organizationId }) {
    const docs = await CompOff.find({
        organizationId,
        employeeId,
        status: 'approved',
        requestUnit: 'hours',
        isExpired: false,
        isUsed: false,
    }).sort({ workDateKey: 1, createdAt: 1 });

    const open = [];
    let total = 0;
    for (const doc of docs) {
        const left = Math.max(0, round2((doc.requestedHours || 0) - (doc.consumedHours || 0)));
        if (left > 0) {
            open.push({ doc, left });
            total = round2(total + left);
        }
    }

    const { creditDays, consumeHours } = creditFromHourTotal(total);
    if (creditDays <= 0) {
        return { creditDays: 0, remainingHours: total };
    }

    await creditCompensatoryDays({
        employeeId,
        organizationId,
        days: creditDays,
        reason: 'Comp-off hours converted to leave',
    });

    let need = consumeHours;
    for (const item of open) {
        if (need <= 0) break;
        const take = Math.min(item.left, need);
        item.doc.consumedHours = round2((item.doc.consumedHours || 0) + take);
        item.doc.creditDays = round2((item.doc.creditDays || 0) + take / COMP_OFF_FULL_DAY_HOURS);
        item.doc.leaveCredited = true;
        await item.doc.save();
        need = round2(need - take);
    }

    return { creditDays, remainingHours: round2(total - consumeHours) };
}

const USAGE_EPSILON = 0.001;

/** Days an approved compensatory leave should take from the comp-off ledger. */
export function compensatoryLeaveDays(leave) {
    if (!leave) return 0;
    if (leave.isHalfDay) return 0.5;
    const working = Number(leave.workingDays);
    const duration = Number(leave.duration);
    const days = working > 0 ? working : duration;
    if (!Number.isFinite(days) || days <= 0) return 0;
    return round2(days);
}

/**
 * Spread approved compensatory leave across credits, oldest work day first.
 * A pending leave is not passed in, so it leaves the credit unused.
 */
export function allocateCompOffUsage(credits = [], leaves = []) {
    const orderedCredits = [...credits].sort((a, b) => {
        const byDate = String(a.workDateKey || '').localeCompare(String(b.workDateKey || ''));
        if (byDate !== 0) return byDate;
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    });
    const slots = new Map(
        orderedCredits.map((credit) => [
            String(credit._id || credit.id),
            { usedDays: 0, isUsed: false, usedAt: null, usedInLeave: null },
        ])
    );
    const orderedLeaves = [...leaves].sort(
        (a, b) => new Date(a.approvedAt || a.startDate || 0) - new Date(b.approvedAt || b.startDate || 0)
    );

    for (const leave of orderedLeaves) {
        let need = compensatoryLeaveDays(leave);
        const usedAt = leave.approvedAt || leave.startDate || null;
        const leaveId = leave._id || leave.id || null;
        for (const credit of orderedCredits) {
            if (need <= USAGE_EPSILON) break;
            const id = String(credit._id || credit.id);
            const slot = slots.get(id);
            if (!slot || credit.isExpired) continue;
            if (
                credit.expiryDate &&
                leave.startDate &&
                new Date(credit.expiryDate) < new Date(leave.startDate)
            ) {
                continue;
            }
            const credited = round2(Number(credit.creditDays) || 0);
            const left = round2(credited - slot.usedDays);
            if (left <= USAGE_EPSILON) continue;
            const take = round2(Math.min(left, need));
            slot.usedDays = round2(slot.usedDays + take);
            slot.usedAt = usedAt;
            slot.usedInLeave = leaveId;
            slot.isUsed = slot.usedDays >= credited - USAGE_EPSILON;
            need = round2(need - take);
        }
    }

    return orderedCredits.map((credit) => ({
        id: String(credit._id || credit.id),
        ...slots.get(String(credit._id || credit.id)),
    }));
}

/**
 * Rewrite used days from approved compensatory leaves.
 * Safe to run again: the result is calculated from those leaves, not added on top.
 */
export async function syncCompOffUsage({ employeeId, organizationId }) {
    if (!employeeId || !organizationId) return { updated: 0 };

    const [leaves, credits] = await Promise.all([
        Leave.find({
            employee: employeeId,
            organizationId,
            leaveType: 'compensatory',
            status: 'approved',
        })
            .select('_id isHalfDay workingDays duration startDate approvedAt')
            .lean(),
        CompOff.find({
            employeeId,
            organizationId,
            status: 'approved',
            creditDays: { $gt: 0 },
        }).sort({ workDateKey: 1, createdAt: 1 }),
    ]);

    const allocation = allocateCompOffUsage(credits, leaves);
    const byId = new Map(allocation.map((row) => [row.id, row]));
    let updated = 0;

    for (const doc of credits) {
        const slot = byId.get(String(doc._id));
        if (!slot) continue;
        const nextLeave = slot.usedDays > 0 ? slot.usedInLeave : null;
        const nextUsedAt = slot.usedDays > 0 ? slot.usedAt : null;
        const unchanged =
            round2(doc.usedDays || 0) === slot.usedDays &&
            Boolean(doc.isUsed) === Boolean(slot.isUsed) &&
            String(doc.usedInLeave || '') === String(nextLeave || '');
        if (unchanged) continue;
        doc.usedDays = slot.usedDays;
        doc.isUsed = slot.isUsed;
        doc.usedAt = nextUsedAt;
        doc.usedInLeave = nextLeave;
        await doc.save();
        updated += 1;
    }

    return { updated };
}

export async function syncCompOffUsageForLeave(leave) {
    if (!leave || leave.leaveType !== 'compensatory') return { updated: 0 };
    const employeeId = leave.employee?._id || leave.employee;
    const organizationId = leave.organizationId;
    if (!employeeId || !organizationId) return { updated: 0 };
    return syncCompOffUsage({ employeeId, organizationId });
}

function parseHm(value) {
    const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;
    return hours * 60 + minutes;
}

function round2(value) {
    return Math.round(Number(value) * 100) / 100;
}
