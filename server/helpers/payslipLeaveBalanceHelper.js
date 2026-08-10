/**
 * Resolve leave balances for payslip "as on last day of {month}".
 */

import leaveBalanceEngine from '../services/leaveBalanceEngine.js';
import logger from './logger.js';

function formatDays(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0';
    const rounded = Math.round(n * 100) / 100;
    if (Math.abs(rounded - Math.round(rounded)) < 0.001) return String(Math.round(rounded));
    return String(rounded);
}

/**
 * @returns {Promise<string>} e.g. "2.5 Days" (sum of Casual + Paid available)
 */
export async function fetchPayslipLeaveBalanceSummary({
    employeeId,
    organizationId,
    month,
    year
}) {
    if (!employeeId || !month || year == null) return '';

    const yearNum = typeof year === 'number' ? year : parseInt(String(year), 10);
    const monthIndex = new Date(`${month} 1, ${yearNum}`).getMonth();
    if (Number.isNaN(monthIndex) || Number.isNaN(yearNum)) return '';

    const asOfDate = leaveBalanceEngine.endOfMonthDate(yearNum, monthIndex);
    const allowedTypes = ['casual', 'paid'];

    try {
        const balance = await leaveBalanceEngine.calculateBalance(
            employeeId,
            yearNum,
            organizationId,
            { asOfDate }
        );

        const rows = balance?.balances || [];
        const total = allowedTypes.reduce((sum, type) => {
            const row = rows.find((b) => String(b.leaveType || '').toLowerCase() === type);
            return sum + (Number(row?.available) || 0);
        }, 0);

        return `${formatDays(total)} Days`;
    } catch (error) {
        logger.warn('Payslip leave balance summary failed', {
            error: error.message,
            employeeId: String(employeeId),
            month,
            year: yearNum
        });
        return '';
    }
}
