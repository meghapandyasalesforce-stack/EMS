import cron from 'node-cron';
import { DateTime } from 'luxon';
import Organization from '../models/organization.model.js';
import Employee from '../models/employee.model.js';
import Payroll from '../models/payroll.model.js';
import logger from '../helpers/logger.js';
import {
    buildGeneratedPayrollPayload,
    isFinalGenerationAllowedForPeriod,
    getPayrollMonthUtcBounds
} from '../helpers/payrollGenerationHelper.js';
import { getCachedEffectiveTimezone } from '../helpers/orgContextCache.js';

async function runPreviewForOrg({ organizationId, month, year, asOf, orgTimezone }) {
    const targetYear = parseInt(year, 10);
    const targetMonthIndex = new Date(`${month} 1, ${targetYear}`).getMonth();
    const { monthStart, monthEnd: endOfMonth } = getPayrollMonthUtcBounds(
        targetYear,
        targetMonthIndex,
        orgTimezone
    );
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
    }).select('salary salaryRevisions organizationId joiningDate department position roleLevel salaryStructure status terminationDate lastWorkingDate financialDetails');

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

async function runFinalForOrg({ organizationId, month, year, now, orgTimezone }) {
    const targetYear = parseInt(year, 10);
    const targetMonthIndex = new Date(`${month} 1, ${targetYear}`).getMonth();

    // Safety: only final on/after month-end in org timezone
    if (!isFinalGenerationAllowedForPeriod(now, targetYear, targetMonthIndex, orgTimezone)) {
        return;
    }

    const { monthStart, monthEnd: endOfMonth } = getPayrollMonthUtcBounds(
        targetYear,
        targetMonthIndex,
        orgTimezone
    );

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
    }).select('salary salaryRevisions organizationId joiningDate department position roleLevel salaryStructure status terminationDate lastWorkingDate financialDetails');

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

        try {
            const organizations = await Organization.find({});

            for (const org of organizations) {
                try {
                    const orgTimezone = await getCachedEffectiveTimezone(org._id);
                    const nowInOrg = DateTime.fromJSDate(now, { zone: orgTimezone });
                    const currentMonth = nowInOrg.setLocale('en-US').toFormat('MMMM');
                    const currentYear = nowInOrg.year;
                    const prevInOrg = nowInOrg.minus({ months: 1 });
                    const prevMonth = prevInOrg.setLocale('en-US').toFormat('MMMM');
                    const prevYear = prevInOrg.year;

                    await runFinalForOrg({
                        organizationId: org._id,
                        month: prevMonth,
                        year: prevYear,
                        now,
                        orgTimezone
                    });

                    await runPreviewForOrg({
                        organizationId: org._id,
                        month: currentMonth,
                        year: currentYear,
                        asOf: now,
                        orgTimezone
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
