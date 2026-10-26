/**
 * Comp-off credit rules.
 * 4 approved hours become half a day. 8 become one full day. Remainder stays as hours.
 * Half-day and full-day requests grant leave immediately and do not enter this hour bank.
 */

import CompOff from '../models/compOff.model.js';
import LeaveBalance from '../models/leaveBalance.model.js';
import { roundLeaveDays } from './leaveBalanceRulesHelper.js';
import logger from './logger.js';

export const COMP_OFF_HALF_DAY_HOURS = 4;
export const COMP_OFF_FULL_DAY_HOURS = 8;

export function hoursBetween(startTime, endTime) {
    const start = parseHm(startTime);
    const end = parseHm(endTime);
    if (start == null || end == null || end <= start) return 0;
    return Math.round(((end - start) / 60) * 100) / 100;
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
