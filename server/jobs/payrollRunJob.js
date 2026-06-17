import cron from 'node-cron';
import Organization from '../models/organization.model.js';
import Employee from '../models/employee.model.js';
import Payroll from '../models/payroll.model.js';
import logger from '../helpers/logger.js';
import { buildGeneratedPayrollPayload, isFinalGenerationAllowedForPeriod } from '../helpers/payrollGenerationHelper.js';

function getMonthLabel(date) {
    return date.toLocaleString('default', { month: 'long' });
}

function calcEndOfMonth(year, monthIndex) {
    const end = new Date(year, monthIndex + 1, 0);
    end.setHours(23, 59, 59, 999);
    return end;
}

async function runPreviewForOrg({ organizationId, month, year, asOf }) {
    const targetYear = parseInt(year, 10);
    const targetMonthIndex = new Date(`${month} 1, ${targetYear}`).getMonth();
    const monthStart = new Date(targetYear, targetMonthIndex, 1);
    monthStart.setHours(0, 0, 0, 0);
    const endOfMonth = calcEndOfMonth(targetYear, targetMonthIndex);
    const employees = await Employee.find({
        salary: { $exists: true, $gt: 0 },
        organizationId,
        $or: [
            { active: true },
            {
                status: 'terminated',
                $or: [
                    { lastWorkingDate: { $gte: monthStart, $lte: endOfMonth } },
                    { terminationDate: { $gte: monthStart, $lte: endOfMonth } }
                ]
            }
        ]
    }).select('salary organizationId joiningDate department position roleLevel salaryStructure status terminationDate lastWorkingDate financialDetails');

    for (const emp of employees) {
        const orgId = emp.organizationId || organizationId;

        const existing = await Payroll.findOne({
            employeeId: emp._id,
            month,
            year: targetYear,
            organizationId: orgId,
            type: 'monthly'
        });

        if (existing && (existing.status === 'Paid' || existing.status === 'Processed' || existing.payrollLocked)) {
            continue;
        }

        const payload = await buildGeneratedPayrollPayload({
            emp,
            month,
            year: targetYear,
            organizationId,
            mode: 'preview',
            asOf
        });

        const meta = {
            organizationId: orgId,
            employeeId: emp._id,
            month,
            year: targetYear,
            type: 'monthly',
            generationType: 'preview',
            isProvisional: true,
            computedAsOf: endOfMonth,
            payrollLocked: false,
            isVisible: true
        };

        if (existing) {
            await Payroll.findByIdAndUpdate(existing._id, {
                ...payload,
                ...meta,
                status: 'Pending'
            });
        } else {
            await Payroll.create({
                ...payload,
                ...meta,
                status: 'Pending'
            });
        }
    }
}

async function runFinalForOrg({ organizationId, month, year, now }) {
    const targetYear = parseInt(year, 10);
    const targetMonthIndex = new Date(`${month} 1, ${targetYear}`).getMonth();

    // Safety: only final on/after month-end
    if (!isFinalGenerationAllowedForPeriod(now, targetYear, targetMonthIndex)) {
        return;
    }

    const endOfMonth = calcEndOfMonth(targetYear, targetMonthIndex);
    const monthStart = new Date(targetYear, targetMonthIndex, 1);
    monthStart.setHours(0, 0, 0, 0);

    const employees = await Employee.find({
        salary: { $exists: true, $gt: 0 },
        organizationId,
        $or: [
            { active: true },
            {
                status: 'terminated',
                $or: [
                    { lastWorkingDate: { $gte: monthStart, $lte: endOfMonth } },
                    { terminationDate: { $gte: monthStart, $lte: endOfMonth } }
                ]
            }
        ]
    }).select('salary organizationId joiningDate department position roleLevel salaryStructure status terminationDate lastWorkingDate financialDetails');

    for (const emp of employees) {
        const orgId = emp.organizationId || organizationId;

        const existing = await Payroll.findOne({
            employeeId: emp._id,
            month,
            year: targetYear,
            organizationId: orgId,
            type: 'monthly'
        });

        if (existing && (existing.status === 'Paid' || existing.payrollLocked || existing.status === 'Processed')) {
            continue;
        }

        const payload = await buildGeneratedPayrollPayload({
            emp,
            month,
            year: targetYear,
            organizationId,
            mode: 'final',
            asOf: now
        });

        const meta = {
            organizationId: orgId,
            employeeId: emp._id,
            month,
            year: targetYear,
            type: 'monthly',
            generationType: 'final',
            isProvisional: false,
            computedAsOf: endOfMonth,
            payrollLocked: false,
            isVisible: true
        };

        if (existing) {
            await Payroll.findByIdAndUpdate(existing._id, {
                ...payload,
                ...meta,
                // Final run publishes closed month payroll as Processed.
                // Paid/locked/processed rows are already skipped above.
                status: 'Processed'
            });
        } else {
            await Payroll.create({
                ...payload,
                ...meta,
                status: 'Processed'
            });
        }
    }
}

export const schedulePayrollRunJobs = () => {
    // Run at 2:00 AM on the 1st day of every month:
    // - Generate FINAL for the previous month
    // - Generate PREVIEW for the current month (employees see estimated/provisional figures)
    cron.schedule('0 2 1 * *', async () => {
        logger.info('Running payroll run automation job');
        const now = new Date();

        const currentMonth = getMonthLabel(now);
        const currentYear = now.getFullYear();

        const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevMonth = getMonthLabel(prevMonthDate);
        const prevYear = prevMonthDate.getFullYear();

        try {
            const organizations = await Organization.find({});

            for (const org of organizations) {
                try {
                    await runFinalForOrg({
                        organizationId: org._id,
                        month: prevMonth,
                        year: prevYear,
                        now
                    });

                    await runPreviewForOrg({
                        organizationId: org._id,
                        month: currentMonth,
                        year: currentYear,
                        asOf: now
                    });
                } catch (orgError) {
                    logger.error('Payroll automation failed for organization', {
                        organizationId: org._id,
                        error: orgError.message
                    });
                }
            }
        } catch (error) {
            logger.error('Payroll automation job failed', { error: error.message });
        }
    });

    logger.info('Payroll automation jobs scheduled');
};

