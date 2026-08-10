/**
 * Payslip component YTD (Indian FY April–March).
 * Sums earnings/deductions from monthly payrolls from FY start through the payslip month.
 */

import Payroll from '../models/payroll.model.js';
import {
    listFyMonthsBefore,
    normalizeMonthName
} from './fyCalendarHelper.js';

const EARNINGS_EXCLUDE = new Set(['totalEarnings', 'total', 'gratuity', 'pfEmployer', 'esiEmployer']);
const DEDUCTIONS_EXCLUDE = new Set(['total', 'totalDeductions']);

function asNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

/**
 * Normalize one payroll's earnings for payslip math (fold legacy gratuity into SPA).
 */
export function normalizePayslipEarnings(earnings) {
    const src = earnings && typeof earnings === 'object' ? { ...earnings } : {};
    const gratuity = asNumber(src.gratuity);
    delete src.gratuity;
    if (gratuity > 0) {
        src.specialAllowance = asNumber(src.specialAllowance) + gratuity;
    }
    return src;
}

function addComponentMap(target, source, excludeKeys) {
    if (!source || typeof source !== 'object') return;
    for (const [key, value] of Object.entries(source)) {
        if (excludeKeys.has(key)) continue;
        const n = asNumber(value);
        if (!n) continue;
        target[key] = asNumber(target[key]) + n;
    }
}

function listFyMonthsThrough(month, year) {
    return [...listFyMonthsBefore(month, year), { month: normalizeMonthName(month), year: Number(year) }];
}

/**
 * Aggregate per-component YTD earnings/deductions for a payslip month (inclusive).
 *
 * @returns {Promise<{ earnings: Record<string, number>, deductions: Record<string, number> }>}
 */
export async function fetchPayslipComponentYtd({
    employeeId,
    organizationId,
    month,
    year,
    currentEarnings = {},
    currentDeductions = {}
}) {
    const empty = { earnings: {}, deductions: {} };
    if (!employeeId || !month || year == null) return empty;

    const monthsThrough = listFyMonthsThrough(month, year).filter((m) => m.month);
    if (!monthsThrough.length) return empty;

    const query = {
        employeeId,
        type: 'monthly',
        isVisible: { $ne: false },
        status: { $nin: ['Cancelled'] },
        $or: monthsThrough.map((m) => ({ month: m.month, year: m.year }))
    };
    if (organizationId) query.organizationId = organizationId;

    const rows = await Payroll.find(query)
        .select('earnings deductions month year updatedAt')
        .lean();

    // Prefer latest updated record per month (same pattern as TDS YTD helper).
    const byKey = new Map();
    for (const row of rows) {
        const key = `${normalizeMonthName(row.month)}-${row.year}`;
        const existing = byKey.get(key);
        if (!existing || new Date(row.updatedAt || 0) > new Date(existing.updatedAt || 0)) {
            byKey.set(key, row);
        }
    }

    const currentKey = `${normalizeMonthName(month)}-${Number(year)}`;
    // Always use the payslip's current month snapshot for the current period
    // (includes any controller-side PF normalization / aggregation choices).
    byKey.set(currentKey, {
        earnings: currentEarnings,
        deductions: currentDeductions,
        month,
        year,
        updatedAt: new Date()
    });

    const earnings = {};
    const deductions = {};
    for (const row of byKey.values()) {
        addComponentMap(earnings, normalizePayslipEarnings(row.earnings), EARNINGS_EXCLUDE);
        addComponentMap(deductions, row.deductions, DEDUCTIONS_EXCLUDE);
    }

    return { earnings, deductions };
}
