import Employee from '../models/employee.model.js';
import { Document } from '../models/document.model.js';
import { OnboardingWorkflow, OffboardingWorkflow } from '../models/onboarding.model.js';
import {
    DEFAULT_ACCESS_REVOCATIONS,
    DEFAULT_OFFBOARDING_CHECKLIST,
    DEFAULT_OFFBOARDING_TASKS,
} from '../constants/offboardingDefaults.js';
import { notify } from '../helpers/notificationManager.js';
import logger from '../helpers/logger.js';
import { emitOffboardingChangedAsync } from '../helpers/backgroundTasks.js';
import { resolveGatedOffboardingTemplate, ensureDefaultOffboardingTemplate } from './lifecycleTemplateEngine.js';
import { getOrCreateLifecycleSettings, isModuleEnabled, isFeatureEnabled } from './lifecycleConfigService.js';
import { applyNoticePeriodToWorkflow } from './noticePeriodService.js';
import {
    applyOffboardingFeatureGates,
    resolveOffboardingProgressWeights,
} from './lifecycleFeatureRuntimeService.js';
import { applyPackArtifactsToOffboardingWorkflow } from './lifecyclePackWorkflowService.js';

export const OFFBOARDING_PROGRESS_WEIGHTS = Object.freeze({
    tasks: 0.25,
    checklist: 0.25,
    assets: 0.15,
    knowledgeTransfer: 0.15,
    payrollClearance: 0.10,
    accessRevocation: 0.10,
});

const DONE_STATUSES = new Set(['Completed', 'Returned', 'Damaged', 'Lost', 'Waived', 'Paid', 'Cleared']);
const ACTIVE_WORKFLOW_STATUSES = new Set(['Initiated', 'In Progress', 'Overdue']);

const startOfDay = (value) => {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
};

const dateKey = (value) => {
    const date = new Date(value);
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
    ].join('-');
};

const percentage = (items, predicate) => {
    const mandatory = (items || []).filter((item) => item.mandatory !== false);
    if (!mandatory.length) return 100;
    return Math.round((mandatory.filter(predicate).length / mandatory.length) * 100);
};

const roleProgress = (tasks, role) => {
    const roleTasks = (tasks || []).filter((task) => (task.assigneeRole || 'employee') === role);
    if (!roleTasks.length) return 100;
    return Math.round((roleTasks.filter((task) => task.status === 'Completed').length / roleTasks.length) * 100);
};

export function calculateOffboardingProgress(workflow, settings = null) {
    const weights = settings
        ? resolveOffboardingProgressWeights(settings)
        : OFFBOARDING_PROGRESS_WEIGHTS;

    const activeTasks = (workflow.tasks || []).filter((task) => task.title !== 'Complete exit interview');
    const tasks = percentage(activeTasks, (task) => task.status === 'Completed');
    const checklist = percentage(workflow.clearanceChecklist, (item) => item.completed);
    const assets = percentage(workflow.assets, (asset) =>
        asset.returned || DONE_STATUSES.has(asset.status));
    const knowledgeTransfer = percentage(workflow.knowledgeTransfer, (item) =>
        DONE_STATUSES.has(item.status));
    const accessRevocation = percentage(workflow.accessRevocation, (item) =>
        DONE_STATUSES.has(item.status));

    const payrollMandatory = workflow.finalSettlement?.mandatory !== false;
    const payrollClearance = !payrollMandatory
        || ['Paid', 'Cleared', 'Waived'].includes(workflow.finalSettlement?.status) ? 100 : 0;

    const values = {
        tasks,
        checklist,
        assets,
        knowledgeTransfer,
        payrollClearance,
        accessRevocation,
    };
    const overall = Math.round(Object.entries(weights)
        .reduce((sum, [key, weight]) => sum + (values[key] || 0) * weight, 0));

    return {
        ...values,
        byRole: {
            employee: roleProgress(workflow.tasks, 'employee'),
            hr: roleProgress(workflow.tasks, 'hr'),
            manager: roleProgress(workflow.tasks, 'manager'),
            it: roleProgress(workflow.tasks, 'it'),
            payroll: roleProgress(workflow.tasks, 'payroll'),
        },
        overall: Math.min(100, overall),
    };
}

export function hasOffboardingActivity(workflow) {
    return (workflow.tasks || []).some((task) => task.status !== 'Pending')
        || (workflow.clearanceChecklist || []).some((item) => item.completed)
        || (workflow.assets || []).some((asset) => asset.returned || asset.status !== 'Pending')
        || (workflow.knowledgeTransfer || []).some((item) => item.status !== 'Pending')
        || (workflow.accessRevocation || []).some((item) => item.status !== 'Pending')
        || Boolean(workflow.finalSettlement?.status && workflow.finalSettlement.status !== 'Pending');
}

export function synchronizeOffboardingDerivedTasks(workflow, now = new Date()) {
    const completeTask = (title, completed) => {
        if (!completed) return;
        const task = (workflow.tasks || []).find((entry) => entry.title === title);
        if (!task || task.status === 'Completed') return;
        task.status = 'Completed';
        task.completedDate = now;
    };
    const mandatoryAssets = (workflow.assets || []).filter((item) => item.mandatory !== false);
    const mandatoryKnowledge = (workflow.knowledgeTransfer || []).filter((item) => item.mandatory !== false);
    const mandatoryAccess = (workflow.accessRevocation || []).filter((item) => item.mandatory !== false);

    completeTask(
        'Complete knowledge transfer',
        mandatoryKnowledge.every((item) => DONE_STATUSES.has(item.status)),
    );
    completeTask(
        'Collect company assets',
        mandatoryAssets.every((item) => item.returned || DONE_STATUSES.has(item.status)),
    );
    completeTask(
        'Revoke system and physical access',
        mandatoryAccess.every((item) => DONE_STATUSES.has(item.status)),
    );
    completeTask('Issue experience letter', workflow.experienceLetter?.status === 'Issued');
    completeTask(
        'Complete final settlement clearance',
        ['Paid', 'Cleared', 'Waived'].includes(workflow.finalSettlement?.status),
    );
}

export async function applyOffboardingProgress(workflow, now = new Date(), settings = null) {
    if (settings) {
        applyOffboardingFeatureGates(workflow, settings);
    }
    const retiredExitTask = (workflow.tasks || []).find((task) => task.title === 'Complete exit interview');
    if (retiredExitTask) {
        workflow.tasks = workflow.tasks.filter((task) => task.title !== 'Complete exit interview');
        if (!(workflow.tasks || []).some((task) => task.title === 'Issue experience letter')) {
            const issued = workflow.experienceLetter?.status === 'Issued';
            workflow.tasks.push({
                title: 'Issue experience letter',
                description: 'Upload the employee experience letter to the existing document library.',
                category: 'Documentation',
                assigneeRole: 'hr',
                assignedTo: workflow.assignedHR,
                dueDate: workflow.lastWorkingDate,
                priority: 'High',
                mandatory: retiredExitTask.mandatory !== false,
                status: issued ? 'Completed' : 'Pending',
                completedDate: issued ? now : undefined,
                featureKey: 'experienceLetter',
            });
        }
    }
    if (workflow.exitInterview) {
        const exitEnabled = workflow.exitInterview.mandatory !== false
            && workflow.exitInterview.status !== 'Waived';
        if (!exitEnabled) {
            workflow.exitInterview.mandatory = false;
            workflow.exitInterview.status = 'Waived';
        }
    }
    synchronizeOffboardingDerivedTasks(workflow, now);
    const breakdown = calculateOffboardingProgress(workflow, settings);
    workflow.progress = breakdown.overall;
    workflow.progressBreakdown = {
        tasks: breakdown.tasks,
        checklist: breakdown.checklist,
        assets: breakdown.assets,
        knowledgeTransfer: breakdown.knowledgeTransfer,
        // Retained in the persisted shape for backward compatibility only.
        exitInterview: 100,
        payrollClearance: breakdown.payrollClearance,
        accessRevocation: breakdown.accessRevocation,
        byRole: breakdown.byRole,
    };

    if (workflow.status === 'Completed' && workflow.progress < 100) {
        workflow.status = 'In Progress';
        workflow.actualCompletionDate = undefined;
    }
    if (['Draft', 'Scheduled', 'Paused', 'Cancelled', 'On Hold'].includes(workflow.status)) return workflow;

    const dueDate = workflow.expectedCompletionDate || workflow.lastWorkingDate;
    if (dueDate && startOfDay(dueDate) < startOfDay(now) && workflow.progress < 100) {
        workflow.status = 'Overdue';
    } else if (workflow.status === 'Overdue') {
        workflow.status = 'In Progress';
    }

    if (workflow.progress === 100 && ACTIVE_WORKFLOW_STATUSES.has(workflow.status)) {
        workflow.status = 'Completed';
        workflow.actualCompletionDate = now;
    } else if (workflow.status === 'Initiated' && hasOffboardingActivity(workflow)) {
        workflow.status = 'In Progress';
    }
    return workflow;
}

export function addOffboardingActivity(workflow, {
    action, description, actor, actorName, metadata = {},
}) {
    if (!workflow.activityFeed) workflow.activityFeed = [];
    workflow.activityFeed.unshift({
        action,
        description,
        actor: actor?._id || actor,
        actorName: actorName || actor?.name || (actor ? undefined : 'System'),
        metadata,
        createdAt: new Date(),
    });
}

const dueDateForTask = (lastWorkingDate, task) => {
    const dueDate = new Date(lastWorkingDate);
    if (task.dueDaysAfterLastWorkingDate) {
        dueDate.setDate(dueDate.getDate() + task.dueDaysAfterLastWorkingDate);
    } else {
        dueDate.setDate(dueDate.getDate() - (task.dueDaysBeforeLastWorkingDate || 0));
    }
    return dueDate;
};

async function findRoleAssignee(organizationId, role) {
    const rolePatterns = {
        hr: /human resource|^hr$/i,
        it: /^it$|information technology|system admin/i,
        payroll: /payroll|finance|accounts/i,
    };
    const pattern = rolePatterns[role];
    if (!pattern) return null;
    return Employee.findOne({
        organizationId,
        status: 'active',
        $or: [
            { department: pattern },
            { jobTitle: pattern },
            { position: pattern },
            { functionalRoles: { $in: [role, role.toUpperCase()] } },
        ],
    }).select('_id').lean();
}

async function resolveTaskAssignee({ role, employee, assignedHR, assignedManager, organizationId }) {
    if (role === 'employee') return employee._id;
    if (role === 'manager') return assignedManager || employee.managerId || null;
    if (role === 'hr' && assignedHR) return assignedHR;
    return (await findRoleAssignee(organizationId, role))?._id || null;
}

export async function synchronizeOffboardingAssets(workflow) {
    const source = await OnboardingWorkflow.findOne({
        organizationId: workflow.organizationId,
        employeeId: workflow.employeeId?._id || workflow.employeeId,
        isTemplate: { $ne: true },
    }).select('assets').lean();
    if (!source) return false;

    let changed = false;
    for (const asset of workflow.assets || []) {
        if (asset.returned && asset.status === 'Pending') {
            asset.status = 'Returned';
            changed = true;
        }
    }
    const existingIds = new Set((workflow.assets || [])
        .map((asset) => asset.onboardingAssetId?.toString())
        .filter(Boolean));
    const assetKey = (asset) => [
        asset.assetId || asset.serialNumber || '',
        asset.assetName || asset.name || '',
        asset.assetType || '',
    ].map((value) => String(value).trim().toLowerCase()).join('|');
    const existingByKey = new Map((workflow.assets || []).map((asset) => [assetKey(asset), asset]));
    for (const asset of source.assets || []) {
        if (!['Assigned', 'Damaged', 'Lost'].includes(asset.status) || existingIds.has(asset._id.toString())) continue;
        const legacyMatch = existingByKey.get(assetKey(asset));
        if (legacyMatch) {
            legacyMatch.onboardingWorkflowId = source._id;
            legacyMatch.onboardingAssetId = asset._id;
            changed = true;
            continue;
        }
        workflow.assets.push({
            onboardingWorkflowId: source._id,
            onboardingAssetId: asset._id,
            assetType: asset.assetType,
            assetName: asset.name,
            assetId: asset.serialNumber,
            mandatory: asset.mandatory !== false,
            status: asset.status === 'Lost' ? 'Lost' : asset.status === 'Damaged' ? 'Damaged' : 'Pending',
            returned: false,
        });
        changed = true;
    }
    return changed;
}

export async function synchronizeOffboardingDocuments(workflow) {
    const records = await Document.find({
        organizationId: workflow.organizationId,
        relatedTo: 'Employee',
        relatedId: workflow.employeeId?._id || workflow.employeeId,
        isActive: true,
        approvalStatus: { $ne: 'Withdrawn' },
    }).select('approvalStatus requiresApproval').lean();
    const counts = {
        total: records.length,
        pending: records.filter((doc) => doc.requiresApproval && doc.approvalStatus === 'Pending').length,
        verified: records.filter((doc) =>
            doc.approvalStatus === 'Approved' || (!doc.requiresApproval && doc.approvalStatus !== 'Rejected')).length,
        rejected: records.filter((doc) => doc.approvalStatus === 'Rejected').length,
    };
    const changed = ['total', 'pending', 'verified', 'rejected']
        .some((key) => Number(workflow.documentSummary?.[key] || 0) !== counts[key]);
    if (changed || !workflow.documentSummary?.synchronizedAt) {
        workflow.documentSummary = { ...counts, synchronizedAt: new Date() };
    }
    return changed;
}

export async function createEmployeeOffboardingWorkflow({
    employee,
    organizationId,
    lastWorkingDate,
    resignationDate,
    reason,
    reasonDetails,
    assignedHR,
    assignedManager,
    initiatedBy,
    saveAsDraft = false,
    templateId = null,
}) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    if (!isModuleEnabled(settings, 'offboarding')) {
        throw new Error('Offboarding module is disabled for this organization');
    }

    await ensureDefaultOffboardingTemplate(organizationId);
    const template = await resolveGatedOffboardingTemplate(organizationId, templateId);
    if (!template) {
        throw new Error('No offboarding template available');
    }

    const lastDay = new Date(lastWorkingDate);
    const startDate = new Date();
    const status = saveAsDraft ? 'Draft' : startOfDay(startDate) > startOfDay(new Date()) ? 'Scheduled' : 'Initiated';
    const managerId = assignedManager || employee.managerId || null;

    const tasks = [];
    for (const task of template.tasks || DEFAULT_OFFBOARDING_TASKS) {
        tasks.push({
            title: task.title,
            description: task.description,
            category: task.category,
            assigneeRole: task.assigneeRole,
            assignedTo: await resolveTaskAssignee({
                role: task.assigneeRole,
                employee,
                assignedHR,
                assignedManager: managerId,
                organizationId,
            }),
            priority: task.priority,
            mandatory: task.mandatory,
            dueDate: dueDateForTask(lastDay, task),
        });
    }

    const exitInterviewEnabled = isFeatureEnabled(settings, 'exitInterview')
        && template.exitInterview?.enabled === true;

    const workflow = new OffboardingWorkflow({
        organizationId,
        employeeId: employee._id,
        offboardingTemplateId: template._id,
        lastWorkingDate: lastDay,
        resignationDate: resignationDate ? new Date(resignationDate) : undefined,
        startDate,
        expectedCompletionDate: lastDay,
        reason,
        reasonDetails,
        status,
        assignedHR,
        assignedManager: managerId,
        initiatedBy,
        tasks,
        clearanceChecklist: (template.clearanceChecklist || DEFAULT_OFFBOARDING_CHECKLIST).map((item) => ({
            ...item,
            dueDate: lastDay,
        })),
        accessRevocation: (template.accessRevocation || DEFAULT_ACCESS_REVOCATIONS).map((item) => ({
            ...item,
            dueDate: lastDay,
        })),
        knowledgeTransfer: (template.knowledgeTransfer || [{
            topic: 'Role, project and operational handover',
            description: 'Transfer active responsibilities and supporting knowledge before the final working date.',
            transferredBy: employee._id,
            transferredTo: managerId,
            dueDaysBeforeLastWorkingDate: 3,
            mandatory: true,
        }]).map((item) => ({
            topic: item.topic,
            description: item.description,
            transferredBy: employee._id,
            transferredTo: managerId,
            dueDate: dueDateForTask(lastDay, item),
            mandatory: item.mandatory !== false,
        })),
        exitInterview: exitInterviewEnabled
            ? { status: 'Not Scheduled', mandatory: template.exitInterview?.mandatory !== false, questions: [] }
            : { status: 'Waived', mandatory: false, questions: [] },
        experienceLetter: { status: 'Pending' },
        finalSettlement: {
            status: 'Pending',
            mandatory: isFeatureEnabled(settings, 'fnfSettlement')
                && template.finalSettlement?.enabled !== false
                && template.finalSettlement?.mandatory !== false,
        },
    });
    await applyPackArtifactsToOffboardingWorkflow(workflow, organizationId).catch(() => {});
    await synchronizeOffboardingAssets(workflow);
    await synchronizeOffboardingDocuments(workflow);
    await applyNoticePeriodToWorkflow(workflow, organizationId);
    applyOffboardingProgress(workflow, new Date(), settings);
    addOffboardingActivity(workflow, {
        action: 'workflow_created',
        description: saveAsDraft ? 'Offboarding workflow saved as draft' : 'Offboarding workflow initiated',
        actor: initiatedBy,
    });
    await workflow.save();
    try {
        if (isFeatureEnabled(settings, 'exitInterview')) {
            const { provisionExitInterviewSessions } = await import('./lifecycleExitInterviewService.js');
            await provisionExitInterviewSessions(workflow, { actor: initiatedBy });
            await workflow.save();
        }
    } catch {
        /* exit interview provisioning is optional */
    }
    return workflow;
}

export async function saveOffboardingWorkflow(workflow, organizationId, {
    recalculate = true,
    actor,
} = {}) {
    const previousStatus = workflow.status;
    if (recalculate) {
        const settings = await getOrCreateLifecycleSettings(organizationId);
        await synchronizeOffboardingDocuments(workflow);
        applyOffboardingProgress(workflow, new Date(), settings);
    }
    if (previousStatus !== 'Completed' && workflow.status === 'Completed') {
        workflow.completionNotifiedAt = new Date();
        addOffboardingActivity(workflow, {
            action: 'workflow_completed',
            description: 'All mandatory offboarding clearances completed',
            actor,
            actorName: actor ? undefined : 'System',
            metadata: { progress: workflow.progress },
        });

        try {
            const Employee = (await import('../models/employee.model.js')).default;
            const employee = await Employee.findById(workflow.employeeId).lean();
            const settings = await getOrCreateLifecycleSettings(organizationId);
            if (settings.accessRevocationPolicy?.autoRevokeOnLwd) {
                const { revokeAllMandatoryAccess } = await import('./accessRevocationAdapter.js');
                await revokeAllMandatoryAccess(workflow, employee);
            }
            const { createAlumniFromOffboarding } = await import('./lifecycleAlumniService.js');
            await createAlumniFromOffboarding(workflow, employee, { actor });
            const { triggerOffboardingLetters } = await import('./lifecycleLetterAutomationService.js');
            await triggerOffboardingLetters(workflow, organizationId, { actor });
        } catch (err) {
            logger.error('Offboarding completion automation failed', { error: err.message });
        }
    }
    await workflow.save();
    emitOffboardingChangedAsync(organizationId, workflow._id);
    if (previousStatus !== 'Completed' && workflow.status === 'Completed') {
        notify({
            type: 'offboarding_workflow_completed',
            organizationId,
            data: { workflow },
        }).catch((error) => logger.error('Offboarding completion notification failed', { error: error.message }));
    }
    return workflow;
}

export async function synchronizeOffboardingWorkflows(organizationId = null) {
    const query = {
        status: { $nin: ['Draft', 'Cancelled'] },
        ...(organizationId ? { organizationId } : {}),
    };
    const workflows = await OffboardingWorkflow.find(query);
    const result = { workflowsChecked: workflows.length, tasksOverdue: 0, workflowsCompleted: 0, remindersSent: 0, escalationsSent: 0 };
    const now = new Date();

    for (const workflow of workflows) {
        const previousStatus = workflow.status;
        if (workflow.status === 'Scheduled' && startOfDay(workflow.startDate) <= startOfDay(now)) {
            workflow.status = 'Initiated';
            addOffboardingActivity(workflow, {
                action: 'workflow_started',
                description: 'Scheduled offboarding workflow started',
                actorName: 'System',
            });
        }

        for (const task of workflow.tasks || []) {
            if (!task.dueDate || ['Completed', 'Cancelled'].includes(task.status)) continue;
            if (startOfDay(task.dueDate) < startOfDay(now) && task.status !== 'Overdue') {
                task.status = 'Overdue';
                task.overdueAt = now;
                result.tasksOverdue += 1;
            }
        }
        for (const item of workflow.knowledgeTransfer || []) {
            if (item.dueDate && !DONE_STATUSES.has(item.status)
                && startOfDay(item.dueDate) < startOfDay(now)) item.status = 'Overdue';
        }

        await synchronizeOffboardingAssets(workflow);
        await synchronizeOffboardingDocuments(workflow);
        await applyNoticePeriodToWorkflow(workflow, workflow.organizationId);

        const { getOrCreateLifecycleSettings } = await import('./lifecycleConfigService.js');
        const { applyOffboardingFeatureGates, restoreEnabledPackArtifacts } = await import('./lifecycleFeatureRuntimeService.js');
        const lifecycleSettings = await getOrCreateLifecycleSettings(workflow.organizationId);
        applyOffboardingFeatureGates(workflow, lifecycleSettings);
        await restoreEnabledPackArtifacts(workflow, workflow.organizationId, lifecycleSettings, 'offboarding');
        applyOffboardingFeatureGates(workflow, lifecycleSettings);
        applyOffboardingProgress(workflow, now, lifecycleSettings);

        const { processLifecycleEscalations, collectOverdueOffboardingItems } = await import('./lifecycleEscalationService.js');
        const escalationResult = await processLifecycleEscalations({
            organizationId: workflow.organizationId,
            workflow,
            module: 'offboarding',
            overdueItems: collectOverdueOffboardingItems(workflow, now),
            now,
        });
        result.escalationsSent = (result.escalationsSent || 0) + escalationResult.escalationsSent;

        workflow.lastAutomationRunAt = now;

        const remindersEnabled = isFeatureEnabled(lifecycleSettings, 'reminders');

        if (remindersEnabled && previousStatus !== 'Overdue' && workflow.status === 'Overdue' && !workflow.overdueNotifiedAt) {
            workflow.overdueNotifiedAt = now;
            notify({
                type: 'offboarding_workflow_overdue',
                organizationId: workflow.organizationId,
                data: { workflow },
            }).catch((error) => logger.error('Offboarding overdue notification failed', { error: error.message }));
            result.remindersSent += 1;
        }

        const remainingDays = workflow.lastWorkingDate
            ? Math.ceil((startOfDay(workflow.lastWorkingDate) - startOfDay(now)) / 86400000)
            : null;
        if (remindersEnabled && [7, 3, 1, 0].includes(remainingDays) && workflow.progress < 100) {
            const key = `workflow-reminder:${remainingDays}:${dateKey(now)}`;
            if (!(workflow.notificationHistory || []).some((entry) => entry.key === key)) {
                workflow.notificationHistory.push({ key, eventType: 'offboarding_reminder', sentAt: now });
                notify({
                    type: 'offboarding_reminder',
                    organizationId: workflow.organizationId,
                    data: { workflow, remainingDays },
                }).catch((error) => logger.error('Offboarding reminder failed', { error: error.message }));
                result.remindersSent += 1;
            }
        }

        if (previousStatus !== 'Completed' && workflow.status === 'Completed') {
            workflow.completionNotifiedAt = now;
            addOffboardingActivity(workflow, {
                action: 'workflow_completed',
                description: 'All mandatory offboarding clearances completed',
                actorName: 'System',
            });
            notify({
                type: 'offboarding_workflow_completed',
                organizationId: workflow.organizationId,
                data: { workflow },
            }).catch((error) => logger.error('Offboarding completion notification failed', { error: error.message }));
            result.workflowsCompleted += 1;
        }
        const changed = workflow.isModified();
        await workflow.save();
        if (previousStatus !== workflow.status || changed) {
            emitOffboardingChangedAsync(workflow.organizationId, workflow._id);
        }
    }
    return result;
}

export function buildOffboardingDashboardStats(workflows) {
    const now = new Date();
    const active = workflows.filter((workflow) => ['Initiated', 'In Progress', 'Overdue'].includes(workflow.status));
    return {
        totalSeparations: workflows.length,
        active: active.length,
        upcoming: workflows.filter((workflow) =>
            workflow.lastWorkingDate && startOfDay(workflow.lastWorkingDate) >= startOfDay(now)
            && !['Completed', 'Cancelled'].includes(workflow.status)).length,
        overdue: workflows.filter((workflow) => workflow.status === 'Overdue').length,
        completed: workflows.filter((workflow) => workflow.status === 'Completed').length,
        pendingAssets: workflows.reduce((count, workflow) =>
            count + (workflow.assets || []).filter((asset) => !asset.returned && asset.status === 'Pending').length, 0),
        pendingClearances: workflows.reduce((count, workflow) =>
            count + (workflow.clearanceChecklist || []).filter((item) => item.mandatory !== false && !item.completed).length, 0),
        averageProgress: workflows.length
            ? Math.round(workflows.reduce((sum, workflow) => sum + (workflow.progress || 0), 0) / workflows.length)
            : 0,
    };
}

