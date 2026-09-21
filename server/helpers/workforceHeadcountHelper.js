/**
 * Live headcount helpers for Workforce Planning.
 * Current counts always come from active Employee records.
 */

import Employee from '../models/employee.model.js';
import { WorkforcePlan } from '../models/workforce.model.js';
import { Recruitment } from '../models/recruitment.model.js';
import logger from './logger.js';

const ACTIVE_STATUSES = ['active'];

/**
 * Build employee match filter for live headcount.
 */
export const buildActiveEmployeeFilter = (organizationId, { department, jobTitle } = {}) => {
    const filter = {
        organizationId,
        status: { $in: ACTIVE_STATUSES },
    };
    if (department) filter.department = department;
    if (jobTitle) filter.jobTitle = jobTitle;
    return filter;
};

/**
 * Count active employees, optionally by department and/or job title.
 */
export const getLiveHeadcount = async (organizationId, filters = {}) => {
    if (!organizationId) return 0;
    return Employee.countDocuments(buildActiveEmployeeFilter(organizationId, filters));
};

/**
 * Aggregate active headcount by department.
 */
export const getHeadcountByDepartment = async (organizationId) => {
    if (!organizationId) return [];
    return Employee.aggregate([
        { $match: buildActiveEmployeeFilter(organizationId) },
        { $group: { _id: '$department', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
    ]);
};

/**
 * Aggregate active headcount by department + jobTitle.
 */
export const getHeadcountByDepartmentAndJobTitle = async (organizationId) => {
    if (!organizationId) return [];
    return Employee.aggregate([
        { $match: buildActiveEmployeeFilter(organizationId) },
        {
            $group: {
                _id: { department: '$department', jobTitle: '$jobTitle' },
                count: { $sum: 1 }
            }
        },
        { $sort: { count: -1 } }
    ]);
};

/**
 * Gap display = |required - current|.
 * Status from comparison: Current < Required → Shortage, > → Surplus, = → Balanced.
 * signedGap kept for internal math (required - current).
 */
export const computeGap = (required, current) => {
    const requiredNum = Number(required) || 0;
    const currentNum = Number(current) || 0;
    const signedGap = requiredNum - currentNum;
    const gap = Math.abs(signedGap);
    let status = 'Balanced';
    if (currentNum < requiredNum) status = 'Shortage';
    else if (currentNum > requiredNum) status = 'Surplus';
    return {
        gap,
        signedGap,
        status,
        required: requiredNum,
        current: currentNum,
    };
};

/**
 * Enrich a plan object/document with live headcount and gap.
 */
export const enrichPlanWithLiveData = async (plan, organizationId) => {
    const plain = typeof plan.toObject === 'function' ? plan.toObject() : { ...plan };
    const liveCurrentHeadcount = await getLiveHeadcount(organizationId, {
        department: plain.department || undefined,
        jobTitle: plain.jobTitle || undefined
    });
    const { gap, status } = computeGap(plain.targetHeadcount, liveCurrentHeadcount);

    const hiringPlan = await Promise.all(
        (plain.hiringPlan || []).map(async (item) => {
            const hiring = { ...item };
            const required = Number(hiring.numberOfPositions) || 0;
            let filled = Number(hiring.filledPositions) || 0;

            if (hiring.recruitmentJobId) {
                try {
                    const job = await Recruitment.findOne({
                        _id: hiring.recruitmentJobId,
                        organizationId
                    }).select('filledPositions numberOfPositions status').lean();
                    if (job) {
                        filled = Math.max(filled, Number(job.filledPositions) || 0);
                        hiring.recruitmentStatus = job.status;
                    }
                } catch (err) {
                    logger.warn('Failed to sync hiring fill from recruitment', { error: err.message });
                }
            }

            hiring.filledPositions = filled;
            hiring.remainingPositions = Math.max(required - filled, 0);
            if (required > 0 && filled >= required && hiring.status !== 'Cancelled') {
                hiring.status = 'Filled';
            }
            return hiring;
        })
    );

    const openPositions = hiringPlan
        .filter((h) => h.status !== 'Filled' && h.status !== 'Cancelled')
        .reduce((sum, h) => sum + (h.remainingPositions || 0), 0);

    const totalRequiredPositions = hiringPlan.reduce((sum, h) => sum + (Number(h.numberOfPositions) || 0), 0);
    const totalFilledPositions = hiringPlan.reduce((sum, h) => sum + (Number(h.filledPositions) || 0), 0);

    return {
        ...plain,
        liveCurrentHeadcount,
        // Prefer live count for display; keep stored currentHeadcount for history
        currentHeadcount: liveCurrentHeadcount,
        gap,
        gapStatus: status,
        hiringPlan,
        fillTracking: {
            required: totalRequiredPositions,
            filled: totalFilledPositions,
            remaining: Math.max(totalRequiredPositions - totalFilledPositions, 0),
            openPositions
        }
    };
};

/**
 * Persist refreshed live currentHeadcount (and hiring fill) onto a plan document.
 */
export const refreshPlanLiveHeadcount = async (planDoc, organizationId) => {
    const liveCurrentHeadcount = await getLiveHeadcount(organizationId, {
        department: planDoc.department || undefined,
        jobTitle: planDoc.jobTitle || undefined
    });
    planDoc.currentHeadcount = liveCurrentHeadcount;

    if (Array.isArray(planDoc.hiringPlan)) {
        for (const hiring of planDoc.hiringPlan) {
            if (!hiring.recruitmentJobId) continue;
            const job = await Recruitment.findOne({
                _id: hiring.recruitmentJobId,
                organizationId
            }).select('filledPositions').lean();
            if (job) {
                hiring.filledPositions = Number(job.filledPositions) || 0;
                const required = Number(hiring.numberOfPositions) || 0;
                if (required > 0 && hiring.filledPositions >= required && hiring.status !== 'Cancelled') {
                    hiring.status = 'Filled';
                } else if (hiring.status === 'Filled' && hiring.filledPositions < required) {
                    hiring.status = 'In Progress';
                }
            }
        }
    }

    await planDoc.save();
    return planDoc;
};

/**
 * When a new employee joins, increment fill on matching open hiring lines.
 * Fire-and-forget safe; never throws to callers.
 */
export const syncWorkforceFillOnEmployeeJoin = async (employee) => {
    try {
        if (!employee?.organizationId || !employee.department) return;

        const plans = await WorkforcePlan.find({
            organizationId: employee.organizationId,
            status: { $in: ['Draft', 'Approved', 'In Progress'] },
            'hiringPlan.0': { $exists: true }
        });

        for (const plan of plans) {
            let changed = false;
            for (const hiring of plan.hiringPlan || []) {
                if (hiring.status === 'Filled' || hiring.status === 'Cancelled') continue;

                const deptMatch =
                    !hiring.department ||
                    hiring.department === employee.department ||
                    plan.department === employee.department;
                const titleMatch =
                    !hiring.jobTitle ||
                    !employee.jobTitle ||
                    hiring.jobTitle === employee.jobTitle ||
                    plan.jobTitle === employee.jobTitle;

                if (!deptMatch || !titleMatch) continue;

                const required = Number(hiring.numberOfPositions) || 0;
                const filled = Number(hiring.filledPositions) || 0;
                if (required > 0 && filled >= required) {
                    hiring.status = 'Filled';
                    changed = true;
                    continue;
                }

                hiring.filledPositions = filled + 1;
                if (hiring.status === 'Planned') hiring.status = 'In Progress';
                if (required > 0 && hiring.filledPositions >= required) {
                    hiring.status = 'Filled';
                }

                if (hiring.recruitmentJobId) {
                    await Recruitment.updateOne(
                        { _id: hiring.recruitmentJobId, organizationId: employee.organizationId },
                        {
                            $inc: { filledPositions: 1 },
                            $set: {
                                ...(hiring.status === 'Filled' ? { status: 'Closed' } : {})
                            }
                        }
                    );
                }
                changed = true;
            }

            if (changed) {
                plan.currentHeadcount = await getLiveHeadcount(employee.organizationId, {
                    department: plan.department || undefined,
                    jobTitle: plan.jobTitle || undefined
                });
                await plan.save();
            }
        }
    } catch (err) {
        logger.warn('Workforce fill sync on employee join failed', { error: err.message });
    }
};
