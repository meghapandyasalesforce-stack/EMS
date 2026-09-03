import { WorkforcePlan, HeadcountForecast } from '../../models/workforce.model.js';
import { Recruitment } from '../../models/recruitment.model.js';
import { getOrganizationId, addOrganizationFilter } from '../../helpers/organizationHelper.js';
import asyncHandler from '../../middlewares/asyncHandler.js';
import {
    getLiveHeadcount,
    getHeadcountByDepartment,
    getHeadcountByDepartmentAndJobTitle,
    enrichPlanWithLiveData,
    refreshPlanLiveHeadcount,
    computeGap
} from '../../helpers/workforceHeadcountHelper.js';

const normalizeJobTitle = (body = {}) => body.jobTitle || body.designation || undefined;

const getActorId = (req) => req.employee?._id || req.user?._id;

const populatePlanActors = (query) =>
    query
        .populate('createdBy', 'name email')
        .populate('approvedBy', 'name email')
        .populate('rejectedBy', 'name email')
        .populate('submittedBy', 'name email');

const findOrgPlan = async (id, organizationId) =>
    WorkforcePlan.findOne({ _id: id, organizationId });

const respondWithPlan = async (res, plan, organizationId, message, statusCode = 200) => {
    const populated = await populatePlanActors(WorkforcePlan.findById(plan._id));
    res.status(statusCode).json({
        success: true,
        ...(message ? { message } : {}),
        data: await enrichPlanWithLiveData(populated, organizationId)
    });
};

/**
 * Resolve live current headcount for a plan payload.
 */
const resolveLiveCurrent = async (organizationId, body = {}) => {
    const jobTitle = normalizeJobTitle(body);
    return getLiveHeadcount(organizationId, {
        department: body.department || undefined,
        jobTitle: jobTitle || undefined
    });
};

/**
 * Create workforce plan
 */
export const createWorkforcePlan = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const createdBy = getActorId(req);

    const jobTitle = normalizeJobTitle(req.body);
    const liveCurrent = await resolveLiveCurrent(organizationId, { ...req.body, jobTitle });
    const currentHeadcount =
        req.body.useLiveHeadcount === false && req.body.currentHeadcount != null
            ? Number(req.body.currentHeadcount)
            : liveCurrent;

    // New plans always start as Draft; status transitions use dedicated workflow endpoints
    const workforcePlan = new WorkforcePlan({
        ...req.body,
        jobTitle: jobTitle || req.body.jobTitle,
        designation: req.body.designation || jobTitle,
        currentHeadcount,
        organizationId,
        createdBy,
        status: 'Draft',
        approvedBy: undefined,
        approvedAt: undefined,
        rejectionReason: undefined,
        rejectedBy: undefined,
        rejectedAt: undefined,
        submittedAt: undefined,
        submittedBy: undefined
    });

    await workforcePlan.save();

    await respondWithPlan(res, workforcePlan, organizationId, 'Workforce plan created successfully', 201);
});

/**
 * Get workforce plans
 */
export const getWorkforcePlans = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { planYear, department, status, jobTitle } = req.query;

    const query = addOrganizationFilter(req, {});

    if (planYear) query.planYear = planYear;
    if (department) query.department = department;
    if (status) query.status = status;
    if (jobTitle) query.jobTitle = jobTitle;

    const plans = await populatePlanActors(
        WorkforcePlan.find(query).sort({ planYear: -1, createdAt: -1 })
    );

    const enriched = await Promise.all(plans.map((plan) => enrichPlanWithLiveData(plan, organizationId)));

    res.json({
        success: true,
        data: enriched
    });
});

/**
 * Create headcount forecast
 */
export const createHeadcountForecast = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const createdBy = req.user?._id || req.employee?._id;

    const liveCurrent = await getLiveHeadcount(organizationId, {
        department: req.body.department || undefined
    });

    const forecast = new HeadcountForecast({
        ...req.body,
        currentHeadcount:
            req.body.useLiveHeadcount === false && req.body.currentHeadcount != null
                ? Number(req.body.currentHeadcount)
                : liveCurrent,
        organizationId,
        createdBy
    });

    await forecast.save();

    res.status(201).json({
        success: true,
        message: 'Headcount forecast created successfully',
        data: forecast
    });
});

/**
 * Get headcount forecasts
 */
export const getHeadcountForecasts = asyncHandler(async (req, res) => {
    const { department, startDate, endDate } = req.query;

    const query = addOrganizationFilter(req, {});

    if (department) query.department = department;
    if (startDate || endDate) {
        query.forecastDate = {};
        if (startDate) query.forecastDate.$gte = new Date(startDate);
        if (endDate) query.forecastDate.$lte = new Date(endDate);
    }

    const forecasts = await HeadcountForecast.find(query)
        .populate('createdBy', 'name email')
        .sort({ forecastDate: -1 });

    res.json({
        success: true,
        data: forecasts
    });
});

/**
 * Get single workforce plan
 */
export const getWorkforcePlan = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const plan = await populatePlanActors(
        WorkforcePlan.findOne({
            _id: id,
            organizationId
        })
    );

    if (!plan) {
        return res.status(404).json({
            success: false,
            message: 'Workforce plan not found'
        });
    }

    // Refresh persisted live headcount + recruitment fill sync
    await refreshPlanLiveHeadcount(plan, organizationId);
    const refreshed = await populatePlanActors(WorkforcePlan.findById(plan._id));

    res.json({
        success: true,
        data: await enrichPlanWithLiveData(refreshed, organizationId)
    });
});

/**
 * Update workforce plan
 */
export const updateWorkforcePlan = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const plan = await findOrgPlan(id, organizationId);

    if (!plan) {
        return res.status(404).json({
            success: false,
            message: 'Workforce plan not found'
        });
    }

    // Status transitions are handled only by workflow endpoints
    const {
        status: _ignoredStatus,
        approvedBy: _ignoredApprovedBy,
        approvedAt: _ignoredApprovedAt,
        rejectionReason: _ignoredRejectionReason,
        rejectedBy: _ignoredRejectedBy,
        rejectedAt: _ignoredRejectedAt,
        submittedAt: _ignoredSubmittedAt,
        submittedBy: _ignoredSubmittedBy,
        ...safeBody
    } = req.body || {};

    const jobTitle = normalizeJobTitle(safeBody);
    if (jobTitle !== undefined) {
        safeBody.jobTitle = jobTitle;
        if (!safeBody.designation) safeBody.designation = jobTitle;
    }

    Object.assign(plan, safeBody);
    
    // Recalculate budget remaining if budget fields changed
    if (safeBody.budget) {
        plan.budget = plan.budget || {};
        plan.budget.remaining = (plan.budget.allocated || 0) - (plan.budget.spent || 0);
    }

    // Keep current headcount live unless explicitly overridden
    if (safeBody.useLiveHeadcount !== false) {
        plan.currentHeadcount = await resolveLiveCurrent(organizationId, {
            department: plan.department,
            jobTitle: plan.jobTitle
        });
    }

    await plan.save();

    await respondWithPlan(res, plan, organizationId, 'Workforce plan updated successfully');
});

/**
 * Submit workforce plan for approval (Draft / Rejected → Pending Approval)
 */
export const submitWorkforcePlan = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const plan = await findOrgPlan(req.params.id, organizationId);

    if (!plan) {
        return res.status(404).json({ success: false, message: 'Workforce plan not found' });
    }
    if (!['Draft', 'Rejected'].includes(plan.status)) {
        return res.status(400).json({
            success: false,
            message: 'Only Draft or Rejected plans can be submitted for approval'
        });
    }

    plan.status = 'Pending Approval';
    plan.submittedBy = getActorId(req);
    plan.submittedAt = new Date();
    plan.rejectionReason = null;
    plan.rejectedBy = null;
    plan.rejectedAt = null;
    await plan.save();

    await respondWithPlan(res, plan, organizationId, 'Workforce plan submitted for approval');
});

/**
 * Approve workforce plan (Pending Approval → Approved)
 */
export const approveWorkforcePlan = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const plan = await findOrgPlan(req.params.id, organizationId);

    if (!plan) {
        return res.status(404).json({ success: false, message: 'Workforce plan not found' });
    }
    if (plan.status !== 'Pending Approval') {
        return res.status(400).json({
            success: false,
            message: 'Only plans pending approval can be approved'
        });
    }

    plan.status = 'Approved';
    plan.approvedBy = getActorId(req);
    plan.approvedAt = new Date();
    plan.rejectionReason = null;
    plan.rejectedBy = null;
    plan.rejectedAt = null;
    await plan.save();

    await respondWithPlan(res, plan, organizationId, 'Workforce plan approved');
});

/**
 * Reject workforce plan (Pending Approval → Rejected)
 */
export const rejectWorkforcePlan = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const plan = await findOrgPlan(req.params.id, organizationId);

    if (!plan) {
        return res.status(404).json({ success: false, message: 'Workforce plan not found' });
    }
    if (plan.status !== 'Pending Approval') {
        return res.status(400).json({
            success: false,
            message: 'Only plans pending approval can be rejected'
        });
    }

    const reason = String(req.body?.reason || req.body?.rejectionReason || '').trim();
    if (!reason) {
        return res.status(400).json({
            success: false,
            message: 'Rejection reason is required'
        });
    }

    plan.status = 'Rejected';
    plan.rejectionReason = reason;
    plan.rejectedBy = getActorId(req);
    plan.rejectedAt = new Date();
    plan.approvedBy = null;
    plan.approvedAt = null;
    await plan.save();

    await respondWithPlan(res, plan, organizationId, 'Workforce plan rejected');
});

/**
 * Start execution (Approved → In Progress)
 */
export const startWorkforcePlan = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const plan = await findOrgPlan(req.params.id, organizationId);

    if (!plan) {
        return res.status(404).json({ success: false, message: 'Workforce plan not found' });
    }
    if (plan.status !== 'Approved') {
        return res.status(400).json({
            success: false,
            message: 'Only Approved plans can be moved to In Progress'
        });
    }

    plan.status = 'In Progress';
    await plan.save();

    await respondWithPlan(res, plan, organizationId, 'Workforce plan marked as In Progress');
});

/**
 * Complete workforce plan (In Progress → Completed)
 */
export const completeWorkforcePlan = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const plan = await findOrgPlan(req.params.id, organizationId);

    if (!plan) {
        return res.status(404).json({ success: false, message: 'Workforce plan not found' });
    }
    if (plan.status !== 'In Progress') {
        return res.status(400).json({
            success: false,
            message: 'Only In Progress plans can be marked Completed'
        });
    }

    plan.status = 'Completed';
    await plan.save();

    await respondWithPlan(res, plan, organizationId, 'Workforce plan marked as Completed');
});

/**
 * Delete workforce plan
 */
export const deleteWorkforcePlan = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const plan = await findOrgPlan(id, organizationId);

    if (!plan) {
        return res.status(404).json({
            success: false,
            message: 'Workforce plan not found'
        });
    }

    await WorkforcePlan.deleteOne({ _id: id });

    res.json({
        success: true,
        message: 'Workforce plan deleted successfully'
    });
});

/**
 * Get single headcount forecast
 */
export const getHeadcountForecast = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const forecast = await HeadcountForecast.findOne({
        _id: id,
        organizationId
    })
        .populate('createdBy', 'name email');

    if (!forecast) {
        return res.status(404).json({
            success: false,
            message: 'Headcount forecast not found'
        });
    }

    res.json({
        success: true,
        data: forecast
    });
});

/**
 * Update headcount forecast
 */
export const updateHeadcountForecast = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const forecast = await HeadcountForecast.findOne({
        _id: id,
        organizationId
    });

    if (!forecast) {
        return res.status(404).json({
            success: false,
            message: 'Headcount forecast not found'
        });
    }

    Object.assign(forecast, req.body);
    await forecast.save();

    const populatedForecast = await HeadcountForecast.findById(forecast._id)
        .populate('createdBy', 'name email');

    res.json({
        success: true,
        message: 'Headcount forecast updated successfully',
        data: populatedForecast
    });
});

/**
 * Delete headcount forecast
 */
export const deleteHeadcountForecast = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const forecast = await HeadcountForecast.findOne({
        _id: id,
        organizationId
    });

    if (!forecast) {
        return res.status(404).json({
            success: false,
            message: 'Headcount forecast not found'
        });
    }

    await HeadcountForecast.deleteOne({ _id: id });

    res.json({
        success: true,
        message: 'Headcount forecast deleted successfully'
    });
});

/**
 * GET live headcount for department / job title
 */
export const getLiveHeadcountEndpoint = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { department, jobTitle, designation } = req.query;
    const title = jobTitle || designation;

    const [total, filtered, byDepartment, byRole] = await Promise.all([
        getLiveHeadcount(organizationId),
        getLiveHeadcount(organizationId, {
            department: department || undefined,
            jobTitle: title || undefined
        }),
        getHeadcountByDepartment(organizationId),
        getHeadcountByDepartmentAndJobTitle(organizationId)
    ]);

    res.json({
        success: true,
        data: {
            totalEmployees: total,
            currentHeadcount: filtered,
            filters: { department: department || null, jobTitle: title || null },
            byDepartment: byDepartment.map((d) => ({
                department: d._id || 'Unassigned',
                count: d.count
            })),
            byDesignation: byRole.map((r) => ({
                department: r._id?.department || 'Unassigned',
                jobTitle: r._id?.jobTitle || 'Unassigned',
                designation: r._id?.jobTitle || 'Unassigned',
                count: r.count
            }))
        }
    });
});

/**
 * Workforce dashboard metrics
 */
export const getWorkforceDashboard = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const query = addOrganizationFilter(req, {});

    const [totalEmployees, plans, byDepartment] = await Promise.all([
        getLiveHeadcount(organizationId),
        WorkforcePlan.find({
            ...query,
            status: { $in: ['Draft', 'Pending Approval', 'Approved', 'In Progress', 'Completed'] }
        }).lean(),
        getHeadcountByDepartment(organizationId)
    ]);

    const activePlans = plans.filter((p) =>
        ['Approved', 'In Progress', 'Draft', 'Pending Approval'].includes(p.status)
    );
    const plannedWorkforce = activePlans.reduce((sum, p) => sum + (Number(p.targetHeadcount) || 0), 0);

    // Prefer sum of plan targets when plans exist; else planned = current
    const planned = activePlans.length > 0 ? plannedWorkforce : totalEmployees;
    const workforceGap = planned - totalEmployees;

    let openPositions = 0;
    let upcomingHiring = [];
    const now = new Date();
    const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    for (const plan of plans) {
        for (const hiring of plan.hiringPlan || []) {
            if (hiring.status === 'Filled' || hiring.status === 'Cancelled') continue;
            const required = Number(hiring.numberOfPositions) || 0;
            const filled = Number(hiring.filledPositions) || 0;
            const remaining = Math.max(required - filled, 0);
            openPositions += remaining;

            const start = hiring.expectedStartDate ? new Date(hiring.expectedStartDate) : null;
            if (remaining > 0 && (!start || (start >= now && start <= in90Days) || start <= in90Days)) {
                upcomingHiring.push({
                    planId: plan._id,
                    planName: plan.planName,
                    position: hiring.position,
                    department: hiring.department || plan.department,
                    jobTitle: hiring.jobTitle || plan.jobTitle,
                    numberOfPositions: required,
                    filledPositions: filled,
                    remainingPositions: remaining,
                    priority: hiring.priority,
                    expectedStartDate: hiring.expectedStartDate || null,
                    status: hiring.status
                });
            }
        }
    }

    upcomingHiring = upcomingHiring
        .sort((a, b) => {
            const da = a.expectedStartDate ? new Date(a.expectedStartDate).getTime() : Infinity;
            const db = b.expectedStartDate ? new Date(b.expectedStartDate).getTime() : Infinity;
            return da - db;
        })
        .slice(0, 20);

    // Department-wise: live current + required from plans
    const requiredByDept = {};
    for (const plan of activePlans) {
        const dept = plan.department || 'Unassigned';
        requiredByDept[dept] = (requiredByDept[dept] || 0) + (Number(plan.targetHeadcount) || 0);
    }

    const departmentSummary = byDepartment.map((d) => {
        const department = d._id || 'Unassigned';
        const current = d.count;
        const required = requiredByDept[department] ?? current;
        const { gap, status } = computeGap(required, current);
        return { department, current, required, gap, status };
    });

    // Include planned departments with zero live employees
    for (const [department, required] of Object.entries(requiredByDept)) {
        if (!departmentSummary.find((d) => d.department === department)) {
            const { gap, status } = computeGap(required, 0);
            departmentSummary.push({ department, current: 0, required, gap, status });
        }
    }

    res.json({
        success: true,
        data: {
            totalEmployees,
            currentWorkforce: totalEmployees,
            plannedWorkforce: planned,
            workforceGap,
            openPositions,
            upcomingHiringCount: upcomingHiring.length,
            upcomingHiring,
            departmentWise: departmentSummary,
            plansCount: plans.length,
            activePlansCount: activePlans.length
        }
    });
});

/**
 * Gap analysis: department / designation vs required
 */
export const getGapAnalysis = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { groupBy = 'designation' } = req.query;
    const query = addOrganizationFilter(req, {});

    const [plans, byDept, byRole] = await Promise.all([
        WorkforcePlan.find({
            ...query,
            status: { $in: ['Draft', 'Pending Approval', 'Approved', 'In Progress'] }
        }).lean(),
        getHeadcountByDepartment(organizationId),
        getHeadcountByDepartmentAndJobTitle(organizationId)
    ]);

    const rows = [];

    if (groupBy === 'department') {
        const requiredMap = {};
        for (const plan of plans) {
            const key = plan.department || 'Unassigned';
            requiredMap[key] = (requiredMap[key] || 0) + (Number(plan.targetHeadcount) || 0);
        }
        const currentMap = {};
        for (const d of byDept) {
            currentMap[d._id || 'Unassigned'] = d.count;
        }
        const keys = new Set([...Object.keys(requiredMap), ...Object.keys(currentMap)]);
        for (const department of keys) {
            const current = currentMap[department] || 0;
            const required = requiredMap[department] != null ? requiredMap[department] : current;
            const { gap, status } = computeGap(required, current);
            rows.push({
                department,
                designation: null,
                jobTitle: null,
                currentHeadcount: current,
                requiredHeadcount: required,
                gap,
                status
            });
        }
    } else {
        const requiredMap = {};
        for (const plan of plans) {
            const department = plan.department || 'Unassigned';
            const jobTitle = plan.jobTitle || plan.designation || 'All Roles';
            const key = `${department}||${jobTitle}`;
            requiredMap[key] = (requiredMap[key] || 0) + (Number(plan.targetHeadcount) || 0);
        }
        const currentMap = {};
        for (const r of byRole) {
            const department = r._id?.department || 'Unassigned';
            const jobTitle = r._id?.jobTitle || 'Unassigned';
            currentMap[`${department}||${jobTitle}`] = r.count;
        }
        const keys = new Set([...Object.keys(requiredMap), ...Object.keys(currentMap)]);
        for (const key of keys) {
            const [department, jobTitle] = key.split('||');
            const current = currentMap[key] || 0;
            const required = requiredMap[key] != null ? requiredMap[key] : current;
            const { gap, status } = computeGap(required, current);
            rows.push({
                department,
                designation: jobTitle,
                jobTitle,
                currentHeadcount: current,
                requiredHeadcount: required,
                gap,
                status
            });
        }
    }

    rows.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));

    const summary = {
        totalShortage: rows.filter((r) => r.gap > 0).reduce((s, r) => s + r.gap, 0),
        totalSurplus: rows.filter((r) => r.gap < 0).reduce((s, r) => s + Math.abs(r.gap), 0),
        balanced: rows.filter((r) => r.gap === 0).length
    };

    res.json({
        success: true,
        data: { groupBy, rows, summary }
    });
});

/**
 * Create / link a Recruitment job opening from a hiring plan line
 */
export const createRecruitmentFromHiring = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const createdBy = req.user?._id || req.employee?._id;
    const { id, hiringIndex } = req.params;
    const index = parseInt(hiringIndex, 10);

    const plan = await WorkforcePlan.findOne({ _id: id, organizationId });
    if (!plan) {
        return res.status(404).json({ success: false, message: 'Workforce plan not found' });
    }
    if (!plan.hiringPlan?.[index]) {
        return res.status(404).json({ success: false, message: 'Hiring requirement not found' });
    }

    const hiring = plan.hiringPlan[index];
    if (hiring.status === 'Cancelled') {
        return res.status(400).json({ success: false, message: 'Cannot create job for a cancelled requirement' });
    }
    if (hiring.recruitmentJobId) {
        const existing = await Recruitment.findById(hiring.recruitmentJobId).lean();
        return res.status(200).json({
            success: true,
            message: 'Recruitment job already linked',
            data: { plan: await enrichPlanWithLiveData(plan, organizationId), jobPosting: existing }
        });
    }

    const remaining = Math.max(
        (Number(hiring.numberOfPositions) || 1) - (Number(hiring.filledPositions) || 0),
        1
    );

    const jobPosting = new Recruitment({
        organizationId,
        createdBy,
        jobTitle: hiring.jobTitle || hiring.position || plan.jobTitle || 'Open Position',
        department: hiring.department || plan.department || 'Administration',
        position: req.body.position || 'Mid-Level',
        jobDescription:
            req.body.jobDescription ||
            `Workforce planning requirement from plan "${plan.planName}".` +
                (hiring.reason || plan.reason ? ` Reason: ${hiring.reason || plan.reason}.` : ''),
        requirements: req.body.requirements || [],
        responsibilities: req.body.responsibilities || [],
        location: req.body.location || 'To be determined',
        employmentType: req.body.employmentType || 'Full-time',
        numberOfPositions: remaining,
        filledPositions: 0,
        priority: hiring.priority || plan.priority || 'Medium',
        status: req.body.status || 'Draft',
        postedDate: (req.body.status || 'Draft') === 'Open' ? new Date() : null,
        tags: ['workforce-planning', String(plan._id)]
    });

    await jobPosting.save();

    hiring.recruitmentJobId = jobPosting._id;
    if (hiring.status === 'Planned') hiring.status = 'In Progress';
    await plan.save();

    const refreshed = await populatePlanActors(WorkforcePlan.findById(plan._id));

    res.status(201).json({
        success: true,
        message: 'Recruitment job opening created and linked',
        data: {
            plan: await enrichPlanWithLiveData(refreshed, organizationId),
            jobPosting
        }
    });
});

/**
 * Update fill tracking for a hiring line (required / filled / remaining)
 */
export const updateHiringFill = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { id, hiringIndex } = req.params;
    const index = parseInt(hiringIndex, 10);

    const plan = await WorkforcePlan.findOne({ _id: id, organizationId });
    if (!plan) {
        return res.status(404).json({ success: false, message: 'Workforce plan not found' });
    }
    if (!plan.hiringPlan?.[index]) {
        return res.status(404).json({ success: false, message: 'Hiring requirement not found' });
    }

    const hiring = plan.hiringPlan[index];
    if (req.body.filledPositions != null) {
        hiring.filledPositions = Math.max(0, Number(req.body.filledPositions) || 0);
    }
    if (req.body.numberOfPositions != null) {
        hiring.numberOfPositions = Math.max(0, Number(req.body.numberOfPositions) || 0);
    }
    if (req.body.status) {
        hiring.status = req.body.status;
    }

    const required = Number(hiring.numberOfPositions) || 0;
    const filled = Number(hiring.filledPositions) || 0;
    if (required > 0 && filled >= required && hiring.status !== 'Cancelled') {
        hiring.status = 'Filled';
    } else if (hiring.status === 'Filled' && filled < required) {
        hiring.status = 'In Progress';
    }

    if (hiring.recruitmentJobId) {
        await Recruitment.updateOne(
            { _id: hiring.recruitmentJobId, organizationId },
            {
                $set: {
                    filledPositions: filled,
                    numberOfPositions: required || 1,
                    ...(hiring.status === 'Filled' ? { status: 'Closed' } : {})
                }
            }
        );
    }

    plan.currentHeadcount = await resolveLiveCurrent(organizationId, {
        department: plan.department,
        jobTitle: plan.jobTitle
    });
    await plan.save();

    const refreshed = await populatePlanActors(WorkforcePlan.findById(plan._id));

    res.json({
        success: true,
        message: 'Fill tracking updated',
        data: await enrichPlanWithLiveData(refreshed, organizationId)
    });
});

/**
 * Basic workforce reports (department / designation / current vs required)
 */
export const getWorkforceReports = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const query = addOrganizationFilter(req, {});

    const [plans, byDept, byRole, totalEmployees] = await Promise.all([
        WorkforcePlan.find({
            ...query,
            status: { $in: ['Draft', 'Pending Approval', 'Approved', 'In Progress'] }
        }).lean(),
        getHeadcountByDepartment(organizationId),
        getHeadcountByDepartmentAndJobTitle(organizationId),
        getLiveHeadcount(organizationId)
    ]);

    const requiredByDept = {};
    const requiredByRole = {};
    let totalRequired = 0;

    for (const plan of plans) {
        const dept = plan.department || 'Unassigned';
        const title = plan.jobTitle || plan.designation || 'All Roles';
        const target = Number(plan.targetHeadcount) || 0;
        requiredByDept[dept] = (requiredByDept[dept] || 0) + target;
        const roleKey = `${dept}||${title}`;
        requiredByRole[roleKey] = (requiredByRole[roleKey] || 0) + target;
        totalRequired += target;
    }

    const departmentWise = byDept.map((d) => {
        const department = d._id || 'Unassigned';
        const current = d.count;
        const required = requiredByDept[department] ?? current;
        const { gap, status } = computeGap(required, current);
        return { department, currentHeadcount: current, requiredHeadcount: required, gap, status };
    });
    for (const [department, required] of Object.entries(requiredByDept)) {
        if (!departmentWise.find((r) => r.department === department)) {
            const { gap, status } = computeGap(required, 0);
            departmentWise.push({
                department,
                currentHeadcount: 0,
                requiredHeadcount: required,
                gap,
                status
            });
        }
    }

    const designationWise = byRole.map((r) => {
        const department = r._id?.department || 'Unassigned';
        const jobTitle = r._id?.jobTitle || 'Unassigned';
        const key = `${department}||${jobTitle}`;
        const current = r.count;
        const required = requiredByRole[key] ?? current;
        const { gap, status } = computeGap(required, current);
        return {
            department,
            designation: jobTitle,
            jobTitle,
            currentHeadcount: current,
            requiredHeadcount: required,
            gap,
            status
        };
    });
    for (const [key, required] of Object.entries(requiredByRole)) {
        const [department, jobTitle] = key.split('||');
        if (!designationWise.find((r) => r.department === department && r.jobTitle === jobTitle)) {
            const { gap, status } = computeGap(required, 0);
            designationWise.push({
                department,
                designation: jobTitle,
                jobTitle,
                currentHeadcount: 0,
                requiredHeadcount: required,
                gap,
                status
            });
        }
    }

    const { gap: overallGap, status: overallStatus } = computeGap(
        totalRequired || totalEmployees,
        totalEmployees
    );

    const currentVsRequired = {
        currentHeadcount: totalEmployees,
        requiredHeadcount: totalRequired || totalEmployees,
        gap: overallGap,
        status: overallStatus,
        byDepartment: departmentWise,
        byDesignation: designationWise
    };

    // CSV helpers for export
    const toCsv = (headers, rows) => {
        const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        return [headers.join(','), ...rows.map((row) => row.map(escape).join(','))].join('\n');
    };

    const exportCsv = {
        departmentWise: toCsv(
            ['Department', 'Current', 'Required', 'Gap', 'Status'],
            departmentWise.map((r) => [r.department, r.currentHeadcount, r.requiredHeadcount, r.gap, r.status])
        ),
        designationWise: toCsv(
            ['Department', 'Designation', 'Current', 'Required', 'Gap', 'Status'],
            designationWise.map((r) => [
                r.department,
                r.designation,
                r.currentHeadcount,
                r.requiredHeadcount,
                r.gap,
                r.status
            ])
        ),
        currentVsRequired: toCsv(
            ['Metric', 'Value'],
            [
                ['Current Headcount', currentVsRequired.currentHeadcount],
                ['Required Headcount', currentVsRequired.requiredHeadcount],
                ['Gap', currentVsRequired.gap],
                ['Status', currentVsRequired.status]
            ]
        )
    };

    res.json({
        success: true,
        data: {
            departmentWise,
            designationWise,
            currentVsRequired,
            exportCsv
        }
    });
});

/**
 * Get workforce analytics (extended with live metrics; preserves existing shape)
 */
export const getWorkforceAnalytics = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { startDate, endDate, department } = req.query;

    const query = addOrganizationFilter(req, {});
    if (department) query.department = department;

    // Get workforce plans statistics
    const [totalPlans, activePlans, plansByStatus, plansByDepartment] = await Promise.all([
        WorkforcePlan.countDocuments(query),
        WorkforcePlan.countDocuments({ ...query, status: { $in: ['Approved', 'In Progress'] } }),
        WorkforcePlan.aggregate([
            { $match: query },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),
        WorkforcePlan.aggregate([
            { $match: query },
            { $group: { _id: '$department', count: { $sum: 1 } } }
        ])
    ]);

    // Get headcount forecast statistics
    const dateFilter = {};
    if (startDate || endDate) {
        dateFilter.forecastDate = {};
        if (startDate) dateFilter.forecastDate.$gte = new Date(startDate);
        if (endDate) dateFilter.forecastDate.$lte = new Date(endDate);
    }

    const forecastQuery = { ...query, ...dateFilter };
    const [totalForecasts, forecastsByDepartment, avgProjectedHeadcount] = await Promise.all([
        HeadcountForecast.countDocuments(forecastQuery),
        HeadcountForecast.aggregate([
            { $match: forecastQuery },
            { $group: { _id: '$department', count: { $sum: 1 } } }
        ]),
        HeadcountForecast.aggregate([
            { $match: forecastQuery },
            {
                $group: {
                    _id: null,
                    avgProjected: { $avg: '$projectedHeadcount' },
                    avgCurrent: { $avg: '$currentHeadcount' },
                    totalNewHires: { $sum: '$newHires' },
                    totalTerminations: { $sum: '$terminations' }
                }
            }
        ])
    ]);

    // Get budget statistics
    const budgetStats = await WorkforcePlan.aggregate([
        { $match: query },
        {
            $group: {
                _id: null,
                totalAllocated: { $sum: '$budget.allocated' },
                totalSpent: { $sum: '$budget.spent' },
                totalRemaining: { $sum: '$budget.remaining' },
                avgAllocated: { $avg: '$budget.allocated' }
            }
        }
    ]);

    // Get hiring plan statistics
    const hiringPlanStats = await WorkforcePlan.aggregate([
        { $match: query },
        { $unwind: '$hiringPlan' },
        {
            $group: {
                _id: '$hiringPlan.status',
                count: { $sum: 1 },
                totalPositions: { $sum: '$hiringPlan.numberOfPositions' },
                totalFilled: { $sum: { $ifNull: ['$hiringPlan.filledPositions', 0] } },
                totalBudget: { $sum: '$hiringPlan.budget' }
            }
        }
    ]);

    // Get skills gap analysis
    const skillsGapStats = await WorkforcePlan.aggregate([
        { $match: query },
        { $unwind: '$skillsRequired' },
        {
            $group: {
                _id: '$skillsRequired.skill',
                totalRequired: { $sum: '$skillsRequired.requiredCount' },
                totalCurrent: { $sum: '$skillsRequired.currentCount' },
                totalGap: { $sum: '$skillsRequired.gap' }
            }
        },
        { $sort: { totalGap: -1 } },
        { $limit: 10 }
    ]);

    const [totalEmployees, byDepartmentLive] = await Promise.all([
        getLiveHeadcount(organizationId, { department: department || undefined }),
        getHeadcountByDepartment(organizationId)
    ]);

    const analytics = {
        workforcePlans: {
            total: totalPlans,
            active: activePlans,
            byStatus: plansByStatus.reduce((acc, item) => {
                acc[item._id] = item.count;
                return acc;
            }, {}),
            byDepartment: plansByDepartment.reduce((acc, item) => {
                acc[item._id || 'Unassigned'] = item.count;
                return acc;
            }, {})
        },
        headcountForecasts: {
            total: totalForecasts,
            byDepartment: forecastsByDepartment.reduce((acc, item) => {
                acc[item._id || 'Unassigned'] = item.count;
                return acc;
            }, {}),
            averages: avgProjectedHeadcount.length > 0 ? {
                avgProjectedHeadcount: Math.round(avgProjectedHeadcount[0].avgProjected || 0),
                avgCurrentHeadcount: Math.round(avgProjectedHeadcount[0].avgCurrent || 0),
                totalNewHires: avgProjectedHeadcount[0].totalNewHires || 0,
                totalTerminations: avgProjectedHeadcount[0].totalTerminations || 0
            } : {
                avgProjectedHeadcount: 0,
                avgCurrentHeadcount: 0,
                totalNewHires: 0,
                totalTerminations: 0
            }
        },
        budget: budgetStats.length > 0 ? {
            totalAllocated: budgetStats[0].totalAllocated || 0,
            totalSpent: budgetStats[0].totalSpent || 0,
            totalRemaining: budgetStats[0].totalRemaining || 0,
            avgAllocated: Math.round(budgetStats[0].avgAllocated || 0),
            utilizationRate: budgetStats[0].totalAllocated > 0
                ? Math.round((budgetStats[0].totalSpent / budgetStats[0].totalAllocated) * 100)
                : 0
        } : {
            totalAllocated: 0,
            totalSpent: 0,
            totalRemaining: 0,
            avgAllocated: 0,
            utilizationRate: 0
        },
        hiringPlans: hiringPlanStats.reduce((acc, item) => {
            acc[item._id] = {
                count: item.count,
                totalPositions: item.totalPositions,
                totalFilled: item.totalFilled,
                totalBudget: item.totalBudget
            };
            return acc;
        }, {}),
        skillsGap: skillsGapStats.map(item => ({
            skill: item._id,
            required: item.totalRequired,
            current: item.totalCurrent,
            gap: item.totalGap
        })),
        liveHeadcount: {
            totalEmployees,
            byDepartment: byDepartmentLive.map((d) => ({
                department: d._id || 'Unassigned',
                count: d.count
            }))
        },
        period: {
            startDate: startDate || null,
            endDate: endDate || null
        }
    };

    res.json({
        success: true,
        data: analytics
    });
});
