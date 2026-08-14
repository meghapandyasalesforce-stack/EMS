import {
    EngagementActionPlan,
    ACTION_PLAN_STATUSES,
    ACTION_PLAN_PRIORITIES,
    ACTION_PLAN_SOURCE_TYPES,
    Survey,
    Feedback
} from '../../models/engagement.model.js';
import Employee from '../../models/employee.model.js';
import { getOrganizationId, addOrganizationFilter } from '../../helpers/organizationHelper.js';
import {
    loadRequestEmployee,
    isEngagementManager,
    getRequestActorId,
    getManagedTeamEmployeeIds,
    canManageRecognition
} from '../../helpers/engagementHelper.js';
import { hasPermission } from '../../helpers/permissionService.js';
import { PERMISSIONS } from '../../config/permissions.constants.js';
import asyncHandler from '../../middlewares/asyncHandler.js';
import { notify } from '../../helpers/notificationManager.js';
import { loadEngagementSettings } from '../../helpers/engagementSettingsHelper.js';
import logger from '../../helpers/logger.js';

const safeNotify = async (payload) => {
    try {
        const settings = await loadEngagementSettings(payload.organizationId);
        if (payload.type === 'engagement.action_plan.assigned' && !settings.notifications.actionPlanAssigned) {
            return;
        }
        if (
            (payload.type === 'engagement.action_plan.due_soon' ||
                payload.type === 'engagement.action_plan.overdue') &&
            settings.notifications.actionPlanDue === false
        ) {
            return;
        }
        await notify(payload);
    } catch (err) {
        logger.warn('Action plan notification failed', { type: payload?.type, error: err.message });
    }
};

const canManageOrgActionPlans = (req, employee) => {
    if (req.authContext?.isOrgOwner) return true;
    if (isEngagementManager(req, employee)) return true;
    return (
        hasPermission(req.authContext, PERMISSIONS.ENGAGEMENT_MANAGE) ||
        hasPermission(req.authContext, PERMISSIONS.ENGAGEMENT_SURVEY_MANAGE) ||
        hasPermission(req.authContext, PERMISSIONS.ENGAGEMENT_ANALYTICS_ORG)
    );
};

const canViewTeamPlans = (req) =>
    hasPermission(req.authContext, PERMISSIONS.ENGAGEMENT_ANALYTICS_TEAM) ||
    canManageRecognition(req.authContext);

const populatePlan = (query) =>
    query
        .populate('owner', 'name lastName email department')
        .populate('assignedBy', 'name lastName email department');

export const createActionPlan = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const employee = await loadRequestEmployee(req);
    if (!canManageOrgActionPlans(req, employee)) {
        return res.status(403).json({
            success: false,
            message: 'Only HR/Admin can create action plans',
            code: 'INSUFFICIENT_PERMISSIONS'
        });
    }

    const { title, description, sourceType, sourceId, department, owner, priority, dueDate } = req.body;
    if (!title || !owner) {
        return res.status(400).json({ success: false, message: 'Title and owner are required' });
    }

    const ownerEmp = await Employee.findOne({ _id: owner, organizationId, status: 'active' })
        .select('_id')
        .lean();
    if (!ownerEmp) {
        return res.status(400).json({ success: false, message: 'Owner must be an active employee in this organization' });
    }

    const plan = await EngagementActionPlan.create({
        organizationId,
        title: String(title).slice(0, 200),
        description: description ? String(description).slice(0, 4000) : undefined,
        sourceType: ACTION_PLAN_SOURCE_TYPES.includes(sourceType) ? sourceType : 'Manual',
        sourceId: sourceId || undefined,
        department: department || undefined,
        owner,
        assignedBy: getRequestActorId(req),
        priority: ACTION_PLAN_PRIORITIES.includes(priority) ? priority : 'Medium',
        dueDate: dueDate || undefined,
        status: 'Open'
    });

    await safeNotify({
        type: 'engagement.action_plan.assigned',
        organizationId,
        data: { plan, ownerId: owner }
    });

    const populated = await populatePlan(EngagementActionPlan.findById(plan._id));
    res.status(201).json({ success: true, message: 'Action plan created', data: populated });
});

export const getActionPlans = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const employee = await loadRequestEmployee(req);
    const orgManage = canManageOrgActionPlans(req, employee);
    const { status, owner, page = 1, limit = 50, sourceType } = req.query;

    const query = addOrganizationFilter(req, {});
    if (status) query.status = status;
    if (sourceType) query.sourceType = sourceType;

    if (!orgManage) {
        const actorId = employee?._id;
        if (!actorId) {
            return res.status(403).json({ success: false, message: 'Access denied', code: 'INSUFFICIENT_PERMISSIONS' });
        }
        if (canViewTeamPlans(req)) {
            const teamIds = await getManagedTeamEmployeeIds(organizationId, actorId);
            query.owner = { $in: [...teamIds, actorId] };
        } else {
            query.owner = actorId;
        }
    } else if (owner) {
        query.owner = owner;
    }

    const parsedLimit = Math.min(parseInt(limit, 10) || 50, 200);
    const skip = (parseInt(page, 10) - 1) * parsedLimit;

    const [plans, total] = await Promise.all([
        populatePlan(EngagementActionPlan.find(query).sort({ dueDate: 1, createdAt: -1 }).skip(skip).limit(parsedLimit)),
        EngagementActionPlan.countDocuments(query)
    ]);

    const now = new Date();
    const surveyIds = plans
        .filter((p) => ['Survey', 'Pulse'].includes(p.sourceType) && p.sourceId)
        .map((p) => p.sourceId);
    const feedbackIds = plans
        .filter((p) => ['Feedback', 'Suggestion'].includes(p.sourceType) && p.sourceId)
        .map((p) => p.sourceId);

    const [surveys, feedbacks] = await Promise.all([
        surveyIds.length
            ? Survey.find({ _id: { $in: surveyIds }, organizationId }).select('title type lifecycleTrigger').lean()
            : [],
        feedbackIds.length
            ? Feedback.find({ _id: { $in: feedbackIds }, organizationId })
                .select('subject type status anonymous')
                .lean()
            : []
    ]);
    const surveyMap = Object.fromEntries(surveys.map((s) => [String(s._id), s]));
    const feedbackMap = Object.fromEntries(feedbacks.map((f) => [String(f._id), f]));

    const enriched = plans.map((planDoc) => {
        const plan = planDoc.toObject ? planDoc.toObject() : { ...planDoc };
        const due = plan.dueDate ? new Date(plan.dueDate) : null;
        const isOpen = ['Open', 'In Progress'].includes(plan.status);
        const isOverdue = Boolean(due && isOpen && due < now);
        let insightLabel = plan.title;
        let insightDetail = null;
        if (['Survey', 'Pulse'].includes(plan.sourceType) && plan.sourceId) {
            const s = surveyMap[String(plan.sourceId)];
            if (s) {
                insightLabel = s.title || plan.title;
                insightDetail = s.lifecycleTrigger
                    ? `Lifecycle · ${s.lifecycleTrigger}`
                    : s.type || plan.sourceType;
            }
        } else if (['Feedback', 'Suggestion'].includes(plan.sourceType) && plan.sourceId) {
            const f = feedbackMap[String(plan.sourceId)];
            if (f) {
                insightLabel = f.subject || plan.title;
                insightDetail = f.anonymous ? `${f.type || plan.sourceType} (anonymous)` : f.type || plan.sourceType;
            }
        } else {
            insightDetail = plan.sourceType || 'Manual';
        }
        return {
            ...plan,
            insightLabel,
            insightDetail,
            isOverdue,
            followUpCompleted:
                plan.status === 'Completed' &&
                ['Survey', 'Pulse', 'Feedback', 'Suggestion'].includes(plan.sourceType)
        };
    });

    res.json({
        success: true,
        data: enriched,
        pagination: { page: parseInt(page, 10), limit: parsedLimit, total, pages: Math.ceil(total / parsedLimit) || 1 }
    });
});

export const getActionPlanById = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const employee = await loadRequestEmployee(req);
    const plan = await populatePlan(
        EngagementActionPlan.findOne(addOrganizationFilter(req, { _id: req.params.id }))
    );
    if (!plan) return res.status(404).json({ success: false, message: 'Action plan not found' });

    if (!canManageOrgActionPlans(req, employee)) {
        const actorId = String(employee?._id || '');
        const ownerId = String(plan.owner?._id || plan.owner);
        if (actorId !== ownerId) {
            if (!canViewTeamPlans(req)) {
                return res.status(403).json({ success: false, message: 'Access denied', code: 'INSUFFICIENT_PERMISSIONS' });
            }
            const teamIds = await getManagedTeamEmployeeIds(organizationId, employee._id);
            if (!teamIds.map(String).includes(ownerId)) {
                return res.status(403).json({ success: false, message: 'Access denied', code: 'INSUFFICIENT_PERMISSIONS' });
            }
        }
    }

    res.json({ success: true, data: plan });
});

export const updateActionPlan = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const employee = await loadRequestEmployee(req);
    const plan = await EngagementActionPlan.findOne(addOrganizationFilter(req, { _id: req.params.id }));
    if (!plan) return res.status(404).json({ success: false, message: 'Action plan not found' });

    const orgManage = canManageOrgActionPlans(req, employee);
    const isOwner = String(plan.owner) === String(employee?._id);
    if (!orgManage && !isOwner) {
        return res.status(403).json({
            success: false,
            message: 'You can only update action plans assigned to you',
            code: 'INSUFFICIENT_PERMISSIONS'
        });
    }

    const prevStatus = plan.status;
    const prevOwner = String(plan.owner);

    if (orgManage) {
        if (req.body.title) plan.title = String(req.body.title).slice(0, 200);
        if (req.body.description !== undefined) plan.description = String(req.body.description || '').slice(0, 4000);
        if (ACTION_PLAN_SOURCE_TYPES.includes(req.body.sourceType)) plan.sourceType = req.body.sourceType;
        if (req.body.department !== undefined) plan.department = req.body.department || undefined;
        if (ACTION_PLAN_PRIORITIES.includes(req.body.priority)) plan.priority = req.body.priority;
        if (req.body.dueDate !== undefined) plan.dueDate = req.body.dueDate || undefined;
        if (req.body.owner && String(req.body.owner) !== prevOwner) {
            const ownerEmp = await Employee.findOne({ _id: req.body.owner, organizationId, status: 'active' }).select('_id').lean();
            if (!ownerEmp) {
                return res.status(400).json({ success: false, message: 'Owner must be an active employee in this organization' });
            }
            plan.owner = req.body.owner;
        }
    }

    if (req.body.status && ACTION_PLAN_STATUSES.includes(req.body.status)) {
        plan.status = req.body.status;
        if (req.body.status === 'Completed' || req.body.status === 'Cancelled') {
            plan.completedAt = new Date();
        } else {
            plan.completedAt = undefined;
        }
    }
    if (req.body.resolutionRemarks !== undefined) {
        plan.resolutionRemarks = String(req.body.resolutionRemarks || '').slice(0, 4000);
    }

    await plan.save();

    if (String(plan.owner) !== prevOwner) {
        await safeNotify({
            type: 'engagement.action_plan.assigned',
            organizationId,
            data: { plan, ownerId: plan.owner }
        });
    } else if (prevStatus !== plan.status && plan.status === 'Completed') {
        await safeNotify({
            type: 'engagement.action_plan.completed',
            organizationId,
            data: { plan, ownerId: plan.owner, assignedById: plan.assignedBy }
        });
    } else if (prevStatus !== plan.status) {
        await safeNotify({
            type: 'engagement.action_plan.status_updated',
            organizationId,
            data: { plan, ownerId: plan.owner, assignedById: plan.assignedBy }
        });
    }

    const populated = await populatePlan(EngagementActionPlan.findById(plan._id));
    res.json({ success: true, message: 'Action plan updated', data: populated });
});

export const processActionPlanReminders = async () => {
    const now = new Date();
    const soon = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const dueSoon = await EngagementActionPlan.find({
        status: { $in: ['Open', 'In Progress'] },
        dueDate: { $gte: now, $lte: soon },
        $or: [{ lastDueNoticeAt: { $exists: false } }, { lastDueNoticeAt: { $lt: dayAgo } }]
    });

    for (const plan of dueSoon) {
        try {
            await safeNotify({
                type: 'engagement.action_plan.due_soon',
                organizationId: plan.organizationId,
                data: { plan, ownerId: plan.owner }
            });
            plan.lastDueNoticeAt = now;
            await plan.save();
        } catch (error) {
            logger.error('Action plan due-soon notice failed', { planId: plan._id, error: error.message });
        }
    }

    const overdue = await EngagementActionPlan.find({
        status: { $in: ['Open', 'In Progress'] },
        dueDate: { $lt: now },
        $or: [{ lastOverdueNoticeAt: { $exists: false } }, { lastOverdueNoticeAt: { $lt: dayAgo } }]
    });

    for (const plan of overdue) {
        try {
            await safeNotify({
                type: 'engagement.action_plan.overdue',
                organizationId: plan.organizationId,
                data: { plan, ownerId: plan.owner, assignedById: plan.assignedBy }
            });
            plan.lastOverdueNoticeAt = now;
            await plan.save();
        } catch (error) {
            logger.error('Action plan overdue notice failed', { planId: plan._id, error: error.message });
        }
    }
};
