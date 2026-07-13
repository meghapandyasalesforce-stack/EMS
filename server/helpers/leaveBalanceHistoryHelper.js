import LeaveBalance from '../models/leaveBalance.model.js';
import LeaveBalanceAudit from '../models/leaveBalanceAudit.model.js';
import Employee from '../models/employee.model.js';

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Unified leave balance history for HR (additive — does not replace leave request history).
 */
export async function buildEmployeeLeaveHistory(employeeId, organizationId, options = {}) {
    const { year, leaveType, limit = 100 } = options;
    const employee = await Employee.findOne({ _id: employeeId, organizationId })
        .select('name lastName employeeId')
        .lean();
    const employeeName = employee
        ? [employee.name, employee.lastName].filter(Boolean).join(' ')
        : 'Unknown';

    const balanceQuery = { organizationId, employee: employeeId };
    if (year) balanceQuery.year = Number(year);

    const balances = await LeaveBalance.find(balanceQuery).sort({ year: -1 }).lean();
    const auditEntries = await LeaveBalanceAudit.find({
        organizationId,
        employee: employeeId,
        ...(leaveType ? { leaveType } : {}),
    })
        .sort({ performedAt: -1 })
        .limit(limit)
        .lean();

    const rows = [];

    for (const balance of balances) {
        for (const entry of balance.monthlyAllocationLog || []) {
            if (leaveType && entry.leaveType !== leaveType) continue;
            rows.push({
                source: 'monthly_allocation',
                employeeName,
                leaveType: entry.leaveType,
                month: entry.month,
                year: entry.year,
                monthLabel: MONTH_NAMES[(entry.month || 1) - 1],
                leaveAllocated: entry.amount,
                leaveUsed: 0,
                carryForward: 0,
                currentBalance: null,
                updatedDate: entry.allocatedAt,
                action: 'Monthly allocation',
            });
        }

        for (const entry of balance.accrualHistory || []) {
            if (leaveType && entry.leaveType !== leaveType) continue;
            const d = entry.date ? new Date(entry.date) : null;
            rows.push({
                source: 'accrual_history',
                employeeName,
                leaveType: entry.leaveType,
                month: d ? d.getMonth() + 1 : null,
                year: balance.year,
                monthLabel: d ? MONTH_NAMES[d.getMonth()] : null,
                leaveAllocated: entry.method === 'manual' ? entry.amount : entry.amount,
                leaveUsed: 0,
                carryForward: 0,
                currentBalance: entry.amount,
                updatedDate: entry.date,
                action: entry.method === 'manual' ? 'Manual adjustment' : entry.method,
                notes: entry.notes,
            });
        }

        for (const entry of balance.carryForwardHistory || []) {
            if (leaveType && entry.leaveType !== leaveType) continue;
            rows.push({
                source: 'carry_forward_history',
                employeeName,
                leaveType: entry.leaveType,
                month: 1,
                year: entry.toYear,
                monthLabel: 'January',
                leaveAllocated: 0,
                leaveUsed: 0,
                carryForward: entry.amount,
                currentBalance: null,
                updatedDate: entry.date,
                action: `Carry forward ${entry.fromYear} → ${entry.toYear}`,
                previousAvailable: entry.previousAvailable,
            });
        }

        for (const typeBalance of balance.balances || []) {
            if (leaveType && typeBalance.leaveType !== leaveType) continue;
            rows.push({
                source: 'current_snapshot',
                employeeName,
                leaveType: typeBalance.leaveType,
                month: null,
                year: balance.year,
                monthLabel: 'Current',
                leaveAllocated: typeBalance.accrued,
                leaveUsed: typeBalance.used,
                carryForward: typeBalance.carriedForward,
                currentBalance: typeBalance.available,
                updatedDate: balance.updatedAt,
                action: 'Current balance',
            });
        }
    }

    for (const audit of auditEntries) {
        rows.push({
            source: 'audit_log',
            employeeName: audit.employeeName || employeeName,
            leaveType: audit.leaveType,
            month: audit.fromMonth || audit.toMonth,
            year: audit.toYear || audit.fromYear || audit.carryForwardFromYear,
            monthLabel: audit.fromMonth ? MONTH_NAMES[audit.fromMonth - 1] : null,
            leaveAllocated: audit.newBalance?.accrued,
            leaveUsed: audit.newBalance?.used,
            carryForward: audit.newBalance?.carriedForward,
            currentBalance: audit.newBalance?.available,
            previousBalance: audit.previousBalance?.available,
            updatedDate: audit.performedAt,
            action: audit.action,
            notes: audit.notes || audit.remarks,
            updatedBy: audit.performedBy,
        });
    }

    rows.sort((a, b) => new Date(b.updatedDate || 0) - new Date(a.updatedDate || 0));

    return {
        employeeName,
        employeeId: employee?.employeeId,
        history: rows.slice(0, limit),
        total: rows.length,
    };
}

export async function writeLeaveBalanceAuditEntry({
    organizationId,
    employeeId,
    employeeName,
    action,
    leaveType,
    previousBalance,
    newBalance,
    performedBy,
    notes,
    remarks,
    fromYear,
    fromMonth,
    toYear,
    toMonth,
    carryForwardFromYear,
    carryForwardToYear,
}) {
    return LeaveBalanceAudit.create({
        organizationId,
        employee: employeeId,
        employeeName,
        action,
        leaveType,
        previousBalance,
        newBalance,
        performedBy,
        performedByModel: performedBy ? 'Employee' : undefined,
        notes,
        remarks,
        fromYear,
        fromMonth,
        toYear,
        toMonth,
        carryForwardFromYear,
        carryForwardToYear,
        performedAt: new Date(),
    });
}
