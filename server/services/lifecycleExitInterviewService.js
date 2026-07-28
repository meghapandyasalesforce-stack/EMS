/**
 * Exit Interview & Exit Management — reuses Form Builder, Approval, Notifications, Audit.
 */

import {
    LifecycleSettings,
    ExitInterviewTemplate,
    ExitInterviewSession,
    LifecycleFormDefinition,
} from '../models/lifecycle.model.js';
import { OffboardingWorkflow } from '../models/onboarding.model.js';
import Employee from '../models/employee.model.js';
import { logLifecycleAudit } from './lifecycleAuditService.js';
import { initiateLifecycleApproval } from './lifecycleApprovalService.js';
import { notify } from '../helpers/notificationManager.js';
import { validateFormResponses } from './lifecycleFormEngine.js';
import {
    getOrCreateLifecycleSettings,
    isFeatureEnabled,
    assertFeatureEnabled,
    isOrgFeatureEnabled,
} from './lifecycleConfigService.js';

async function requireExitInterview(organizationId) {
    return assertFeatureEnabled(organizationId, 'exitInterview', 'Exit interview');
}

export const EXIT_INTERVIEW_TYPES = Object.freeze([
    { value: 'employee_self', label: 'Employee Self Exit Interview' },
    { value: 'hr', label: 'HR Exit Interview' },
    { value: 'manager', label: 'Manager Exit Interview' },
    { value: 'skip_level', label: 'Skip-Level Interview' },
    { value: 'leadership', label: 'Leadership Interview' },
]);

export const DEFAULT_FEEDBACK_AREAS = [
    'Manager', 'Team', 'Work Culture', 'Salary', 'Benefits', 'Career Growth',
    'Workload', 'Leadership', 'Company Policies', 'Office Environment',
    'Technology', 'HR Experience', 'Training', 'Suggestions',
];

function templateMatches(template, { department, employeeType, reason }) {
    const a = template.assignments || {};
    if (a.departments?.length && department && !a.departments.includes(department)) return false;
    if (a.employeeTypes?.length && employeeType && !a.employeeTypes.includes(employeeType)) return false;
    const reasonList = [...(a.resignationReasons || []), ...(a.terminationTypes || [])];
    if (reasonList.length && reason && !reasonList.includes(reason)) return false;
    return true;
}

export async function getExitInterviewSettings(organizationId) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    const policy = settings.exitInterviewPolicy?.toObject?.() || settings.exitInterviewPolicy || {
        enabled: false,
        mandatory: false,
        anonymousAllowed: true,
        autoSchedule: true,
        autoScheduleDaysBeforeLwd: 7,
        approvalRequired: false,
        reminderDaysBefore: [7, 3, 1],
        feedbackAreas: DEFAULT_FEEDBACK_AREAS,
    };
    return {
        ...policy,
        enabled: Boolean(policy.enabled) && isFeatureEnabled(settings, 'exitInterview'),
    };
}

export async function updateExitInterviewSettings(organizationId, payload, { actor, req } = {}) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    settings.exitInterviewPolicy = { ...(settings.exitInterviewPolicy?.toObject?.() || settings.exitInterviewPolicy || {}), ...payload };
    await settings.save();
    await logLifecycleAudit({
        action: 'Update', entityType: 'LifecycleSettings', entityId: settings._id,
        entityName: 'Exit Interview Policy', req, actor,
    });
    return settings.exitInterviewPolicy;
}

export async function listExitInterviewTemplates(organizationId, filters = {}) {
    const query = { organizationId, isActive: true };
    if (filters.status) query.status = filters.status;
    if (filters.interviewType) query.interviewType = filters.interviewType;
    return ExitInterviewTemplate.find(query).sort({ updatedAt: -1 }).lean();
}

export async function getExitInterviewTemplate(organizationId, templateId) {
    const tpl = await ExitInterviewTemplate.findOne({ _id: templateId, organizationId }).lean();
    if (!tpl) throw new Error('Exit interview template not found');
    return tpl;
}

export async function createExitInterviewTemplate(organizationId, payload, { actor, req } = {}) {
    await requireExitInterview(organizationId);
    const tpl = await ExitInterviewTemplate.create({
        organizationId,
        name: payload.name,
        description: payload.description,
        interviewType: payload.interviewType,
        formDefinitionId: payload.formDefinitionId,
        feedbackAreas: payload.feedbackAreas || DEFAULT_FEEDBACK_AREAS,
        mandatory: payload.mandatory !== false,
        anonymousAllowed: payload.anonymousAllowed || false,
        approvalRequired: payload.approvalRequired || false,
        autoScheduleDaysBeforeLwd: payload.autoScheduleDaysBeforeLwd ?? 7,
        assignments: payload.assignments || {},
        status: 'Draft',
        version: 1,
    });
    await logLifecycleAudit({
        action: 'Create', entityType: 'ExitInterviewTemplate', entityId: tpl._id,
        entityName: tpl.name, req, actor,
    });
    return tpl;
}

export async function updateExitInterviewTemplate(organizationId, templateId, payload, { actor, req } = {}) {
    await requireExitInterview(organizationId);
    const tpl = await ExitInterviewTemplate.findOne({ _id: templateId, organizationId });
    if (!tpl) throw new Error('Exit interview template not found');
    const fields = ['name', 'description', 'interviewType', 'formDefinitionId', 'feedbackAreas',
        'mandatory', 'anonymousAllowed', 'approvalRequired', 'autoScheduleDaysBeforeLwd', 'assignments'];
    for (const f of fields) {
        if (payload[f] !== undefined) tpl[f] = payload[f];
    }
    if (tpl.isModified()) {
        tpl.version = (tpl.version || 1) + 1;
        if (tpl.status === 'Published') tpl.status = 'Draft';
    }
    await tpl.save();
    await logLifecycleAudit({
        action: 'Update', entityType: 'ExitInterviewTemplate', entityId: tpl._id,
        entityName: tpl.name, req, actor,
    });
    return tpl;
}

export async function publishExitInterviewTemplate(organizationId, templateId, { actor, req } = {}) {
    await requireExitInterview(organizationId);
    const tpl = await ExitInterviewTemplate.findOne({ _id: templateId, organizationId });
    if (!tpl) throw new Error('Template not found');
    if (!tpl.formDefinitionId) throw new Error('Link a published Form Builder questionnaire before publishing');
    const form = await LifecycleFormDefinition.findOne({ _id: tpl.formDefinitionId, organizationId, status: 'Published' });
    if (!form) throw new Error('Linked form must be published in Form Builder');
    tpl.status = 'Published';
    tpl.publishedAt = new Date();
    await tpl.save();
    await logLifecycleAudit({
        action: 'Update', entityType: 'ExitInterviewTemplate', entityId: tpl._id,
        entityName: tpl.name, req, actor, metadata: { action: 'publish' },
    });
    return tpl;
}

export async function resolveTemplatesForWorkflow(organizationId, workflow, employee) {
    const policy = await getExitInterviewSettings(organizationId);
    if (!policy.enabled) return [];
    const templates = await ExitInterviewTemplate.find({ organizationId, status: 'Published', isActive: true }).lean();
    const ctx = {
        department: employee?.department,
        employeeType: employee?.employmentType || employee?.employeeType,
        reason: workflow.reason,
    };
    return templates.filter((t) => templateMatches(t, ctx));
}

export async function provisionExitInterviewSessions(workflow, { actor } = {}) {
    const settings = await getOrCreateLifecycleSettings(workflow.organizationId);
    if (!isFeatureEnabled(settings, 'exitInterview')) {
        return { sessions: [], skipped: true, reason: 'exitInterview feature disabled' };
    }
    const organizationId = workflow.organizationId;
    const policy = await getExitInterviewSettings(organizationId);
    if (!policy.enabled) return [];

    const employee = await Employee.findById(workflow.employeeId).lean();
    const templates = await resolveTemplatesForWorkflow(organizationId, workflow, employee);
    const sessions = [];

    for (const tpl of templates) {
        const existing = await ExitInterviewSession.findOne({
            organizationId,
            offboardingWorkflowId: workflow._id,
            templateId: tpl._id,
        });
        if (existing) {
            sessions.push(existing);
            continue;
        }

        let scheduledDate;
        if (policy.autoSchedule !== false && workflow.lastWorkingDate) {
            const daysBefore = tpl.autoScheduleDaysBeforeLwd ?? policy.autoScheduleDaysBeforeLwd ?? 7;
            scheduledDate = new Date(workflow.lastWorkingDate);
            scheduledDate.setDate(scheduledDate.getDate() - daysBefore);
        }

        let conductorId;
        if (tpl.interviewType === 'manager' || tpl.interviewType === 'skip_level') {
            conductorId = workflow.assignedManager;
        } else if (tpl.interviewType === 'hr') {
            conductorId = workflow.assignedHR;
        }

        const session = await ExitInterviewSession.create({
            organizationId,
            offboardingWorkflowId: workflow._id,
            employeeId: workflow.employeeId,
            templateId: tpl._id,
            formDefinitionId: tpl.formDefinitionId,
            interviewType: tpl.interviewType,
            conductorId,
            scheduledDate,
            status: scheduledDate ? 'Scheduled' : 'Draft',
            anonymous: tpl.anonymousAllowed && tpl.interviewType === 'employee_self',
            activityFeed: [{ action: 'created', description: `Exit interview session created (${tpl.interviewType})`, actor: actor?._id }],
        });
        sessions.push(session);

        await notify({
            type: 'lifecycle_exit_interview_assigned',
            organizationId,
            data: { session, employeeId: workflow.employeeId, conductorId },
        }).catch(() => {});
    }

    syncWorkflowExitInterview(workflow, sessions);
    return sessions;
}

export function syncWorkflowExitInterview(workflow, sessions = []) {
    if (!workflow.exitInterview) {
        workflow.exitInterview = { status: 'Not Scheduled', mandatory: true, questions: [], sessions: [] };
    }
    workflow.exitInterview.sessions = sessions.map((s) => ({
        sessionId: s._id,
        interviewType: s.interviewType,
        status: s.status,
        scheduledDate: s.scheduledDate,
        formDefinitionId: s.formDefinitionId,
    }));

    const statuses = sessions.map((s) => s.status);
    if (!sessions.length) {
        workflow.exitInterview.status = workflow.exitInterview.mandatory === false ? 'Waived' : 'Not Scheduled';
    } else if (statuses.every((s) => ['Closed', 'Approved', 'Cancelled'].includes(s))) {
        workflow.exitInterview.status = 'Completed';
        workflow.exitInterview.conductedDate = new Date();
    } else if (statuses.some((s) => s === 'Overdue')) {
        workflow.exitInterview.status = 'Overdue';
    } else if (statuses.some((s) => ['Submitted', 'Pending Approval', 'In Progress'].includes(s))) {
        workflow.exitInterview.status = 'In Progress';
    } else if (statuses.some((s) => s === 'Scheduled')) {
        workflow.exitInterview.status = 'Scheduled';
        const earliest = sessions.filter((s) => s.scheduledDate).sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate))[0];
        if (earliest) workflow.exitInterview.scheduledDate = earliest.scheduledDate;
    }

    const completed = sessions.filter((s) => ['Closed', 'Approved', 'Submitted'].includes(s.status)).length;
    workflow.exitInterview.completionPercent = sessions.length
        ? Math.round((completed / sessions.length) * 100) : 0;
}

export async function listExitInterviewSessions(organizationId, filters = {}) {
    const query = { organizationId };
    if (filters.status) query.status = filters.status;
    if (filters.employeeId) query.employeeId = filters.employeeId;
    if (filters.offboardingWorkflowId) query.offboardingWorkflowId = filters.offboardingWorkflowId;
    if (filters.interviewType) query.interviewType = filters.interviewType;
    if (filters.conductorId) query.conductorId = filters.conductorId;
    return ExitInterviewSession.find(query)
        .populate('employeeId', 'firstName lastName employeeId department')
        .populate('conductorId', 'firstName lastName')
        .populate('templateId', 'name interviewType')
        .sort({ scheduledDate: -1, updatedAt: -1 })
        .lean();
}

export async function getExitInterviewSession(organizationId, sessionId) {
    const session = await ExitInterviewSession.findOne({ _id: sessionId, organizationId })
        .populate('employeeId', 'firstName lastName department')
        .populate('conductorId', 'firstName lastName')
        .populate('formDefinitionId')
        .populate('templateId')
        .lean();
    if (!session) throw new Error('Exit interview session not found');
    return session;
}

export async function scheduleExitInterviewSession(organizationId, sessionId, { scheduledDate, conductorId, actor, req } = {}) {
    await requireExitInterview(organizationId);
    const session = await ExitInterviewSession.findOne({ _id: sessionId, organizationId });
    if (!session) throw new Error('Session not found');
    if (scheduledDate) session.scheduledDate = new Date(scheduledDate);
    if (conductorId) session.conductorId = conductorId;
    session.status = 'Scheduled';
    session.activityFeed.push({ action: 'scheduled', description: 'Interview scheduled', actor: actor?._id });
    await session.save();

    try {
        const { scheduleExitInterviewCalendar } = await import('./calendarIntegrationService.js');
        const Employee = (await import('../models/employee.model.js')).default;
        const employee = await Employee.findById(session.employeeId).select('name lastName').lean();
        const cal = await scheduleExitInterviewCalendar(session.toObject(), {
            employeeName: [employee?.name, employee?.lastName].filter(Boolean).join(' '),
        });
        if (cal.meetingUrl) {
            session.meetingUrl = cal.meetingUrl;
            session.calendarProvider = cal.provider;
        }
        if (cal.icsUrl) session.icsUrl = cal.icsUrl;
        await session.save();
    } catch {
        /* calendar optional */
    }

    const workflow = await OffboardingWorkflow.findById(session.offboardingWorkflowId);
    if (workflow) {
        const allSessions = await ExitInterviewSession.find({ offboardingWorkflowId: workflow._id });
        syncWorkflowExitInterview(workflow, allSessions);
        await workflow.save();
    }

    await notify({
        type: 'lifecycle_exit_interview_scheduled',
        organizationId,
        data: { session, employeeId: session.employeeId },
    }).catch(() => {});

    return session;
}

export async function rescheduleExitInterviewSession(organizationId, sessionId, payload, ctx = {}) {
    return scheduleExitInterviewSession(organizationId, sessionId, { ...payload, ...ctx });
}

export async function cancelExitInterviewSession(organizationId, sessionId, { reason, actor, req } = {}) {
    const session = await ExitInterviewSession.findOne({ _id: sessionId, organizationId });
    if (!session) throw new Error('Session not found');
    session.status = 'Cancelled';
    session.activityFeed.push({ action: 'cancelled', description: reason || 'Interview cancelled', actor: actor?._id });
    await session.save();
    return session;
}

export async function saveExitInterviewDraft(organizationId, sessionId, { responses, rating, feedback, managerComments, rehireEligible, improvementRecommendations, actor } = {}) {
    const session = await ExitInterviewSession.findOne({ _id: sessionId, organizationId });
    if (!session) throw new Error('Session not found');
    if (!['Draft', 'Scheduled', 'In Progress', 'Rejected'].includes(session.status)) {
        throw new Error('Cannot edit this session');
    }
    if (responses) session.responses = responses;
    if (rating != null) session.rating = rating;
    if (feedback != null) session.feedback = feedback;
    if (managerComments != null) session.managerComments = managerComments;
    if (rehireEligible != null) session.rehireEligible = rehireEligible;
    if (improvementRecommendations != null) session.improvementRecommendations = improvementRecommendations;
    if (session.status === 'Scheduled') session.status = 'In Progress';
    session.activityFeed.push({ action: 'draft_saved', description: 'Draft saved', actor: actor?._id });
    await session.save();
    return session;
}

export async function submitExitInterviewSession(organizationId, sessionId, payload, { actor, req } = {}) {
    await requireExitInterview(organizationId);
    const session = await ExitInterviewSession.findOne({ _id: sessionId, organizationId });
    if (!session) throw new Error('Session not found');

    const form = session.formDefinitionId
        ? await LifecycleFormDefinition.findOne({ _id: session.formDefinitionId, organizationId })
        : null;

    const responses = payload.responses || session.responses || {};
    if (form?.fields?.length) {
        const errors = validateFormResponses(form.fields, responses);
        if (errors.length) {
            const err = new Error('Validation failed');
            err.validationErrors = errors;
            throw err;
        }
        session.formVersion = form.version;
    }

    session.responses = responses;
    if (payload.rating != null) session.rating = payload.rating;
    if (payload.feedback != null) session.feedback = payload.feedback;
    if (payload.managerComments != null) session.managerComments = payload.managerComments;
    if (payload.rehireEligible != null) session.rehireEligible = payload.rehireEligible;
    if (payload.improvementRecommendations != null) session.improvementRecommendations = payload.improvementRecommendations;
    session.conductedDate = new Date();
    session.activityFeed.push({ action: 'submitted', description: 'Exit interview submitted', actor: actor?._id });

    const tpl = session.templateId
        ? await ExitInterviewTemplate.findById(session.templateId).lean()
        : null;
    const policy = await getExitInterviewSettings(organizationId);
    const needsApproval = tpl?.approvalRequired || policy.approvalRequired;

    if (needsApproval) {
        session.status = 'Pending Approval';
        const approval = await initiateLifecycleApproval({
            organizationId,
            entityType: 'ExitInterview',
            entityId: session._id,
            requestedBy: actor?._id,
            metadata: { sessionId: session._id, interviewType: session.interviewType },
            req,
            actor,
        });
        if (approval.approvalInstanceId) session.approvalInstanceId = approval.approvalInstanceId;
        else if (approval.status === 'Approved') session.status = 'Approved';
    } else {
        session.status = 'Submitted';
    }

    await session.save();

    const workflow = await OffboardingWorkflow.findById(session.offboardingWorkflowId);
    if (workflow) {
        const allSessions = await ExitInterviewSession.find({ offboardingWorkflowId: workflow._id });
        syncWorkflowExitInterview(workflow, allSessions);
        workflow.exitInterview.activityFeed = workflow.exitInterview.activityFeed || [];
        await workflow.save();
    }

    await notify({
        type: session.status === 'Pending Approval'
            ? 'lifecycle_exit_interview_pending_approval'
            : 'lifecycle_exit_interview_completed',
        organizationId,
        data: { session, employeeId: session.employeeId },
    }).catch(() => {});

    await logLifecycleAudit({
        action: 'Update', entityType: 'ExitInterviewSession', entityId: session._id,
        entityName: `Exit Interview (${session.interviewType})`, req, actor,
        metadata: { status: session.status },
    });

    return session;
}

export async function closeExitInterviewSession(organizationId, sessionId, { actor, req } = {}) {
    const session = await ExitInterviewSession.findOne({ _id: sessionId, organizationId });
    if (!session) throw new Error('Session not found');
    session.status = 'Closed';
    session.activityFeed.push({ action: 'closed', description: 'Interview closed by HR', actor: actor?._id });
    await session.save();

    const workflow = await OffboardingWorkflow.findById(session.offboardingWorkflowId);
    if (workflow) {
        const allSessions = await ExitInterviewSession.find({ offboardingWorkflowId: workflow._id });
        syncWorkflowExitInterview(workflow, allSessions);
        await workflow.save();
    }
    return session;
}

export async function addExitInterviewActionItem(organizationId, sessionId, item, { actor } = {}) {
    const session = await ExitInterviewSession.findOne({ _id: sessionId, organizationId });
    if (!session) throw new Error('Session not found');
    session.actionItems.push({
        title: item.title,
        description: item.description,
        assignedTo: item.assignedTo,
        dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
        status: 'Open',
    });
    session.activityFeed.push({ action: 'action_item_added', description: `Action: ${item.title}`, actor: actor?._id });
    await session.save();
    return session;
}

export async function updateExitInterviewActionItem(organizationId, sessionId, itemId, patch, { actor } = {}) {
    const session = await ExitInterviewSession.findOne({ _id: sessionId, organizationId });
    if (!session) throw new Error('Session not found');
    const item = session.actionItems.id(itemId);
    if (!item) throw new Error('Action item not found');
    Object.assign(item, patch);
    if (patch.status === 'Completed') {
        item.completedAt = new Date();
        item.completedBy = actor?._id;
    }
    await session.save();
    return session;
}

export async function handleExitInterviewApprovalOutcome(sessionId, status, rejectionReason, approverId) {
    const session = await ExitInterviewSession.findById(sessionId);
    if (!session) return;
    if (status === 'Approved') {
        session.status = 'Approved';
        session.activityFeed.push({ action: 'approved', description: 'Exit interview approved', actor: approverId });
    } else if (status === 'Rejected') {
        session.status = 'In Progress';
        session.activityFeed.push({ action: 'rejected', description: rejectionReason || 'Rejected — revise and resubmit', actor: approverId });
    }
    await session.save();

    const workflow = await OffboardingWorkflow.findById(session.offboardingWorkflowId);
    if (workflow) {
        const allSessions = await ExitInterviewSession.find({ offboardingWorkflowId: workflow._id });
        syncWorkflowExitInterview(workflow, allSessions);
        await workflow.save();
    }

    await notify({
        type: status === 'Approved' ? 'lifecycle_exit_interview_approved' : 'lifecycle_exit_interview_rejected',
        organizationId: session.organizationId,
        data: { session, employeeId: session.employeeId },
    }).catch(() => {});
}

export function buildExitInterviewAnalytics(sessions = []) {
    const total = sessions.length;
    const byStatus = sessions.reduce((acc, s) => {
        acc[s.status] = (acc[s.status] || 0) + 1;
        return acc;
    }, {});
    const completed = (byStatus.Closed || 0) + (byStatus.Approved || 0) + (byStatus.Submitted || 0);
    const ratings = sessions.filter((s) => s.rating).map((s) => s.rating);
    const avgRating = ratings.length
        ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length * 10) / 10 : null;

    const byDepartment = {};
    const byReason = {};
    const byManager = {};
    const attritionReasons = {};

    for (const s of sessions) {
        const dept = s.employeeId?.department || 'Unknown';
        byDepartment[dept] = (byDepartment[dept] || 0) + 1;
        const reason = s.responses?.primary_exit_reason || s.responses?.exit_reason || 'Unspecified';
        attritionReasons[reason] = (attritionReasons[reason] || 0) + 1;
        if (s.rehireEligible === true) byManager.rehireYes = (byManager.rehireYes || 0) + 1;
        if (s.rehireEligible === false) byManager.rehireNo = (byManager.rehireNo || 0) + 1;
    }

    const openActions = sessions.reduce((sum, s) => sum + (s.actionItems || []).filter((a) => a.status !== 'Completed').length, 0);

    return {
        total,
        completed,
        completionRate: total ? Math.round((completed / total) * 100) : 0,
        byStatus,
        avgRating,
        byDepartment,
        attritionReasons,
        rehireEligibility: byManager,
        openActionItems: openActions,
    };
}

export async function getExitInterviewAnalytics(organizationId, filters = {}) {
    const query = { organizationId };
    if (filters.from) query.createdAt = { $gte: new Date(filters.from) };
    if (filters.to) query.createdAt = { ...(query.createdAt || {}), $lte: new Date(filters.to) };
    const sessions = await ExitInterviewSession.find(query)
        .populate('employeeId', 'department firstName lastName')
        .lean();
    return buildExitInterviewAnalytics(sessions);
}

export function exportExitInterviewAnalyticsCsv(sessions = []) {
    const header = ['sessionId', 'employeeId', 'interviewType', 'status', 'rating', 'rehireEligible', 'scheduledDate', 'conductedDate'].join(',');
    const rows = sessions.map((s) => [
        s._id,
        s.employeeId?._id || s.employeeId || '',
        s.interviewType,
        s.status,
        s.rating ?? '',
        s.rehireEligible ?? '',
        s.scheduledDate || '',
        s.conductedDate || '',
    ].join(','));
    return [header, ...rows].join('\n');
}

export async function processExitInterviewReminders(organizationId) {
    if (!(await isOrgFeatureEnabled(organizationId, 'exitInterview'))) {
        return { sent: 0, skipped: true };
    }
    if (!(await isOrgFeatureEnabled(organizationId, 'reminders'))) {
        return { sent: 0, skipped: true };
    }
    const policy = await getExitInterviewSettings(organizationId);
    const now = new Date();
    let sent = 0;
    const sessions = await ExitInterviewSession.find({
        organizationId,
        status: { $in: ['Scheduled', 'In Progress', 'Draft'] },
        scheduledDate: { $exists: true },
    });
    for (const session of sessions) {
        const daysUntil = (new Date(session.scheduledDate) - now) / 86400000;
        if (daysUntil < 0) {
            session.status = 'Overdue';
            await session.save();
            await notify({
                type: 'lifecycle_exit_interview_overdue',
                organizationId,
                data: { session, employeeId: session.employeeId },
            }).catch(() => {});
            continue;
        }
        const shouldRemind = (policy.reminderDaysBefore || []).some((d) => daysUntil <= d && daysUntil > d - 1);
        if (shouldRemind) {
            await notify({
                type: 'lifecycle_exit_interview_reminder',
                organizationId,
                data: { session, employeeId: session.employeeId, daysUntil: Math.ceil(daysUntil) },
            }).catch(() => {});
            sent += 1;
        }
    }
    return { sent };
}
