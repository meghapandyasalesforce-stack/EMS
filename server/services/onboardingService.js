import Employee from '../models/employee.model.js';
import Organization from '../models/organization.model.js';
import { Document } from '../models/document.model.js';
import { OnboardingWorkflow, OnboardingTemplate } from '../models/onboarding.model.js';
import {
    DEFAULT_ONBOARDING_CHECKLIST,
    DEFAULT_ONBOARDING_TASKS,
    ONBOARDING_DOCUMENT_TYPES,
    DEFAULT_ASSET_TYPES,
    DEFAULT_TRAINING_MODULES,
    DEFAULT_POLICY_SIGNATURES,
} from '../constants/onboardingDefaults.js';
import { notify } from '../helpers/notificationManager.js';
import logger from '../helpers/logger.js';
import { emitOnboardingChangedAsync, runInBackground } from '../helpers/backgroundTasks.js';
import { getOrgLifecycleOnboardingBridge, isFeatureEnabled, getOrCreateLifecycleSettings, assertModuleEnabled, isOrgFeatureEnabled } from './lifecycleConfigService.js';
import { resolveGatedOnboardingTemplate, ensureDefaultOnboardingTemplate } from './lifecycleTemplateEngine.js';
import { applyPackArtifactsToOnboardingWorkflow } from './lifecyclePackWorkflowService.js';
import { seedMilestonesForWorkflow } from './lifecycleMilestoneService.js';
import { initProbationForWorkflow } from './lifecycleProbationService.js';
import {
    syncEmployeeProbationFromWorkflow,
    employeeHasActiveProbation,
    resolveProbationMonthsFromEmployee,
} from '../helpers/employeeProbationSyncHelper.js';
import { createBgvCase } from './backgroundVerificationService.js';
import { syncFormGateToWorkflow } from './lifecycleFormGateService.js';
import { syncGoalsProgressToWorkflow, autoAssignDefaultProbationGoals } from './lifecycleGoalIntegrationService.js';
import {
    applyOnboardingFeatureGates,
    resolveOnboardingProgressWeights,
    ONBOARDING_BASE_WEIGHTS,
} from './lifecycleFeatureRuntimeService.js';

// Every requirement group contributes to the persisted, database-derived total.
// Keep these weights normalized so overall progress always remains 0-100.
const PROGRESS_WEIGHTS = ONBOARDING_BASE_WEIGHTS;

const RETIRED_DEFAULT_TASK_TITLES = Object.freeze([
    'Complete compliance training',
    '30-day review meeting',
    'Setup email and system access',
]);

function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

function isSameOrBeforeToday(date) {
    if (!date) return false;
    return startOfDay(date) <= startOfDay(new Date());
}

function dueDateFromPhase(baseDate, phase, fallbackDays = 7) {
    const phaseOffsets = {
        'Day 0': 0,
        'Day 1': 1,
        'Week 1': 7,
        'Week 2': 14,
        'Week 3': 21,
        'Month 1': 30,
    };
    const dueDate = new Date(baseDate || Date.now());
    dueDate.setDate(dueDate.getDate() + (phaseOffsets[phase] ?? fallbackDays));
    return dueDate;
}

function localDateKey(date) {
    const value = new Date(date);
    return [
        value.getFullYear(),
        String(value.getMonth() + 1).padStart(2, '0'),
        String(value.getDate()).padStart(2, '0'),
    ].join('-');
}

export function resolveInitialWorkflowStatus({
    joiningDate,
    scheduledStartDate,
    explicitStatus,
    startOnJoiningDate = true,
}) {
    if (explicitStatus === 'Draft') return 'Draft';
    // When org does not delay until joining date, make the workflow visible immediately.
    if (!startOnJoiningDate) {
        const effectiveStart = scheduledStartDate || joiningDate || new Date();
        return isSameOrBeforeToday(effectiveStart) || !scheduledStartDate
            ? 'Not Started'
            : 'Scheduled';
    }
    const effectiveStart = scheduledStartDate || joiningDate;
    // Missing dates should still be employee-visible after create (not stuck as Draft).
    if (!effectiveStart) return 'Not Started';
    if (isSameOrBeforeToday(effectiveStart)) return 'Not Started';
    return 'Scheduled';
}

export async function getOrgOnboardingSettings(organizationId) {
    return getOrgLifecycleOnboardingBridge(organizationId);
}

function calcRoleTaskProgress(tasks, role) {
    const roleTasks = (tasks || []).filter((t) => (t.assigneeRole || 'employee') === role);
    if (!roleTasks.length) return 100;
    const done = roleTasks.filter((t) => t.status === 'Completed').length;
    return Math.round((done / roleTasks.length) * 100);
}

const CANONICAL_DOCUMENT_TYPES = Object.freeze({
    AADHAAR: ['AADHAR_CARD', 'AADHAAR_CARD'],
    PAN: ['PAN_CARD'],
    PASSPORT: ['PASSPORT'],
    DEGREE: ['DEGREE_CERTIFICATE'],
    OFFER_ACK: ['OFFER_LETTER'],
    OTHER: ['OTHER'],
});

const DOCUMENT_NAME_ALIASES = Object.freeze({
    AADHAAR: ['aadhaar', 'aadhar'],
    PAN: ['pan card', 'pan'],
    PASSPORT: ['passport'],
    DEGREE: ['degree', 'marksheet', 'education certificate'],
    EXPERIENCE: ['experience certificate', 'previous employment'],
    RESUME: ['resume', 'cv'],
    OFFER_ACK: ['offer letter', 'offer acknowledgement', 'offer acknowledgment'],
    PHOTO: ['photograph', 'photo'],
    BANK_DETAILS: ['bank details', 'bank account', 'cancelled cheque', 'canceled cheque'],
    OTHER: ['other document'],
});

function normalizeDocumentText(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function canonicalDocumentMatchesRequirement(record, requirement) {
    const jobTypes = CANONICAL_DOCUMENT_TYPES[requirement.documentType] || [];
    if (record.employeeJobDocumentType && jobTypes.includes(record.employeeJobDocumentType)) return true;

    const haystack = normalizeDocumentText([
        record.name,
        record.fileName,
        record.description,
        ...(record.tags || []),
    ].filter(Boolean).join(' '));
    const words = new Set(haystack.split(' ').filter(Boolean));
    return (DOCUMENT_NAME_ALIASES[requirement.documentType] || []).some((alias) => {
        const normalizedAlias = normalizeDocumentText(alias);
        return normalizedAlias.includes(' ')
            ? haystack.includes(normalizedAlias)
            : words.has(normalizedAlias);
    });
}

function canonicalDocumentStatus(record) {
    if (record.approvalStatus === 'Approved' || (!record.requiresApproval && record.approvalStatus !== 'Rejected')) {
        return 'Verified';
    }
    if (record.approvalStatus === 'Rejected') return 'Rejected';
    return 'Uploaded';
}

function applyCanonicalDocuments(workflow, records) {
    let changed = false;
    for (const requirement of workflow.documents || []) {
        const record = records.find((candidate) => canonicalDocumentMatchesRequirement(candidate, requirement));
        if (!record) {
            if (requirement.canonicalDocumentId) {
                requirement.canonicalDocumentId = undefined;
                requirement.url = undefined;
                requirement.originalFileName = undefined;
                requirement.uploadedAt = undefined;
                requirement.uploadedBy = undefined;
                requirement.status = 'Pending';
                requirement.verifiedBy = undefined;
                requirement.verifiedAt = undefined;
                requirement.rejectionReason = undefined;
                changed = true;
            }
            continue;
        }

        const next = {
            canonicalDocumentId: record._id,
            url: record.fileUrl,
            originalFileName: record.fileName,
            uploadedAt: record.createdAt,
            uploadedBy: record.uploadedBy,
            status: canonicalDocumentStatus(record),
            verifiedBy: record.approvedBy,
            verifiedAt: record.approvedAt,
            rejectionReason: record.rejectionReason,
        };
        for (const [key, value] of Object.entries(next)) {
            if (String(requirement[key] || '') !== String(value || '')) {
                requirement[key] = value;
                changed = true;
            }
        }
    }
    return changed;
}

/**
 * Treat the employee's existing profile photo as the onboarding Photograph.
 * Profile photos are already accepted profile data, so no separate document
 * upload or HR verification record is created.
 */
export function applyEmployeeProfilePhoto(workflow, employee) {
    const requirement = (workflow.documents || []).find((doc) => doc.documentType === 'PHOTO');
    if (!requirement || requirement.canonicalDocumentId) return false;

    const profilePhoto = employee?.profilePhoto;
    const isProfilePhotoSource = String(requirement.url || '').startsWith('/uploads/profile-photos/');
    if (!profilePhoto?.url) {
        if (!isProfilePhotoSource) return false;
        requirement.url = undefined;
        requirement.originalFileName = undefined;
        requirement.uploadedAt = undefined;
        requirement.uploadedBy = undefined;
        requirement.status = 'Pending';
        requirement.verifiedBy = undefined;
        requirement.verifiedAt = undefined;
        requirement.rejectionReason = undefined;
        return true;
    }

    const next = {
        url: profilePhoto.url,
        originalFileName: profilePhoto.filename,
        uploadedAt: profilePhoto.uploadedAt,
        uploadedBy: employee._id,
        status: 'Verified',
        verifiedAt: profilePhoto.uploadedAt,
        rejectionReason: undefined,
    };
    let changed = false;
    for (const [key, value] of Object.entries(next)) {
        if (String(requirement[key] || '') !== String(value || '')) {
            requirement[key] = value;
            changed = true;
        }
    }
    return changed;
}

/**
 * Bank details are maintained in Employee Profile > Financial Details.
 * Mirror their completion into onboarding without creating a duplicate document.
 */
export function applyEmployeeFinancialDetails(workflow, employee) {
    const requirement = (workflow.documents || []).find((doc) => doc.documentType === 'BANK_DETAILS');
    if (!requirement || requirement.canonicalDocumentId) return false;

    const financial = employee?.financialDetails || {};
    const complete = Boolean(
        String(financial.bankName || '').trim()
        && String(financial.ifsc || '').trim()
        && String(financial.accountNo || '').trim()
        && String(financial.accountName || '').trim(),
    );
    const isFinancialProfileSource = requirement.url === '/financial-details';

    if (!complete) {
        if (!isFinancialProfileSource) return false;
        requirement.url = undefined;
        requirement.originalFileName = undefined;
        requirement.uploadedAt = undefined;
        requirement.uploadedBy = undefined;
        requirement.status = 'Pending';
        requirement.verifiedBy = undefined;
        requirement.verifiedAt = undefined;
        requirement.rejectionReason = undefined;
        return true;
    }

    const next = {
        url: '/financial-details',
        originalFileName: 'Employee Financial Details',
        uploadedAt: employee.updatedAt,
        uploadedBy: employee._id,
        status: 'Verified',
        verifiedAt: employee.updatedAt,
        rejectionReason: undefined,
    };
    let changed = false;
    for (const [key, value] of Object.entries(next)) {
        if (String(requirement[key] || '') !== String(value || '')) {
            requirement[key] = value;
            changed = true;
        }
    }
    return changed;
}

/**
 * Mirror status only from the canonical Employee Documents collection.
 * The onboarding subdocuments remain requirement definitions, not uploaded-file storage.
 */
export async function synchronizeWorkflowDocuments(workflows) {
    const list = (Array.isArray(workflows) ? workflows : [workflows]).filter(Boolean);
    if (!list.length) return false;

    const employeeIds = [...new Set(list.map((workflow) =>
        (workflow.employeeId?._id || workflow.employeeId)?.toString()).filter(Boolean))];
    if (!employeeIds.length) return false;

    const organizationIds = [...new Set(list.map((workflow) =>
        (workflow.organizationId?._id || workflow.organizationId)?.toString()).filter(Boolean))];
    const documentQuery = {
        uploadedBy: { $in: employeeIds },
        category: 'Employee',
        approvalStatus: { $ne: 'Withdrawn' },
        $or: [
            { isActive: { $ne: false } },
            { approvalStatus: 'Rejected' },
        ],
    };
    const employeeQuery = {
        _id: { $in: employeeIds },
    };
    if (organizationIds.length === 1) {
        documentQuery.organizationId = organizationIds[0];
        employeeQuery.organizationId = organizationIds[0];
    } else if (organizationIds.length > 1) {
        documentQuery.organizationId = { $in: organizationIds };
        employeeQuery.organizationId = { $in: organizationIds };
    }

    const [records, employees] = await Promise.all([
        Document.find(documentQuery).sort({ updatedAt: -1, createdAt: -1 }).lean(),
        Employee.find(employeeQuery).select('_id profilePhoto financialDetails updatedAt').lean(),
    ]);

    const byEmployee = new Map();
    for (const record of records) {
        const key = record.uploadedBy?.toString();
        if (!byEmployee.has(key)) byEmployee.set(key, []);
        byEmployee.get(key).push(record);
    }
    const employeeById = new Map(employees.map((employee) => [employee._id.toString(), employee]));

    let changed = false;
    for (const workflow of list) {
        const employeeId = (workflow.employeeId?._id || workflow.employeeId)?.toString();
        const documentsChanged = applyCanonicalDocuments(
            workflow,
            byEmployee.get(employeeId) || [],
        );
        const profilePhotoChanged = applyEmployeeProfilePhoto(
            workflow,
            employeeById.get(employeeId),
        );
        const financialDetailsChanged = applyEmployeeFinancialDetails(
            workflow,
            employeeById.get(employeeId),
        );
        const resumeRequirement = (workflow.documents || [])
            .find((doc) => doc.documentType === 'RESUME');
        const resumeChanged = Boolean(resumeRequirement?.mandatory !== false);
        if (resumeRequirement) resumeRequirement.mandatory = false;
        const tasksChanged = synchronizeDocumentDrivenTasks(workflow);
        changed = documentsChanged || profilePhotoChanged || financialDetailsChanged
            || resumeChanged || tasksChanged || changed;
    }
    return changed;
}

export function hasWorkflowActivity(workflow) {
    return (workflow.tasks || []).some((task) =>
        ['In Progress', 'Completed'].includes(task.status) || Boolean(task.startedDate || task.completedDate))
        || (workflow.documents || []).some((doc) => ['Uploaded', 'Verified', 'Rejected'].includes(doc.status))
        || (workflow.checklist || []).some((item) => item.completed)
        || (workflow.trainingModules || []).some((module) => module.status !== 'Not Started')
        || (workflow.policySignatures || []).some((signature) => signature.status === 'Signed')
        || (workflow.assets || []).some((asset) => asset.status !== 'Pending');
}

export function calculateProgressBreakdown(workflow, settings = null) {
    const tasks = workflow.tasks || [];
    const documents = workflow.documents || [];
    const checklist = workflow.checklist || [];
    const training = workflow.trainingModules || [];
    const policies = workflow.policySignatures || [];
    const assets = workflow.assets || [];

    const weights = settings
        ? resolveOnboardingProgressWeights(settings)
        : PROGRESS_WEIGHTS;

    const mandatoryTasks = tasks.filter((task) => task.mandatory !== false);
    const completedTasks = mandatoryTasks.filter((t) => t.status === 'Completed').length;
    const tasksProgress = mandatoryTasks.length > 0
        ? Math.round((completedTasks / mandatoryTasks.length) * 100)
        : 100;

    const mandatoryDocs = documents.filter((d) => d.mandatory !== false);
    const mandatoryVerified = mandatoryDocs.filter((d) => d.status === 'Verified').length;
    const documentsProgress = mandatoryDocs.length > 0
        ? Math.round((mandatoryVerified / mandatoryDocs.length) * 100)
        : 100;

    const mandatoryChecklist = checklist.filter((c) => c.mandatory !== false);
    const completedChecklist = mandatoryChecklist.filter((c) => c.completed).length;
    const checklistProgress = mandatoryChecklist.length > 0
        ? Math.round((completedChecklist / mandatoryChecklist.length) * 100)
        : 100;

    const mandatoryTraining = training.filter((t) =>
        t.mandatory !== false && (t.videoUrl || t.documentUrl || t.quizQuestions?.length));
    const completedTraining = mandatoryTraining.filter((t) => t.status === 'Completed').length;
    const trainingProgress = mandatoryTraining.length > 0
        ? Math.round((completedTraining / mandatoryTraining.length) * 100)
        : 100;

    const mandatoryPolicies = policies.filter((p) => p.mandatory !== false && p.documentUrl);
    const policiesProgress = mandatoryPolicies.length > 0
        ? Math.round((mandatoryPolicies.filter((p) => p.status === 'Signed').length / mandatoryPolicies.length) * 100)
        : 100;

    const mandatoryAssets = assets.filter((a) => a.mandatory !== false);
    const assetsProgress = mandatoryAssets.length > 0
        ? Math.round((mandatoryAssets.filter((a) => a.status === 'Assigned').length / mandatoryAssets.length) * 100)
        : 100;

    const formsProgress = workflow.formsProgress ?? 100;
    const goalsProgress = workflow.goalsProgress ?? 100;
    const bgvProgress = workflow.bgvStatus === 'Waived'
        ? 100
        : Number.isFinite(workflow.bgvProgress)
            ? workflow.bgvProgress
            : (workflow.backgroundVerificationCaseId ? 0 : (weights.bgv ? 0 : 100));
    const softwareRequests = workflow.softwareRequests || [];
    const softwareProgress = softwareRequests.length
        ? Math.round((softwareRequests.filter((r) => ['Approved', 'Provisioned'].includes(r.approvalStatus || r.status)).length
            / softwareRequests.length) * 100)
        : 100;

    const overall = Math.round([
        ['tasks', tasksProgress],
        ['documents', documentsProgress],
        ['checklist', checklistProgress],
        ['training', trainingProgress],
        ['policies', policiesProgress],
        ['assets', assetsProgress],
        ['forms', formsProgress],
        ['goals', goalsProgress],
        ['bgv', bgvProgress],
        ['software', softwareProgress],
    ].reduce((sum, [key, value]) => sum + value * (weights[key] || 0), 0));

    const byRole = {
        employee: calcRoleTaskProgress(tasks, 'employee'),
        hr: calcRoleTaskProgress(tasks, 'hr'),
        it: calcRoleTaskProgress(tasks, 'it'),
        manager: calcRoleTaskProgress(tasks, 'manager'),
        buddy: calcRoleTaskProgress(tasks, 'buddy'),
        payroll: calcRoleTaskProgress(tasks, 'payroll'),
    };

    let finalOverall = Math.min(100, overall);
    if (workflow.mandatoryFormsCompleted === false) {
        finalOverall = Math.min(finalOverall, 99);
    }
    if (workflow.bgvBlocksJoining && !['Clear', 'Waived'].includes(workflow.bgvStatus)) {
        finalOverall = Math.min(finalOverall, 99);
    }

    return {
        tasks: tasksProgress,
        documents: documentsProgress,
        checklist: checklistProgress,
        training: trainingProgress,
        policies: policiesProgress,
        assets: assetsProgress,
        forms: formsProgress,
        goals: goalsProgress,
        bgv: bgvProgress,
        software: softwareProgress,
        byRole,
        overall: finalOverall,
        formsGateOpen: workflow.mandatoryFormsCompleted !== false,
        bgvGateOpen: !workflow.bgvBlocksJoining || ['Clear', 'Waived'].includes(workflow.bgvStatus),
    };
}

export function applyProgressToWorkflow(workflow, settings = null) {
    if (settings) {
        applyOnboardingFeatureGates(workflow, settings);
        // Not initiated yet → 0% BGV (never show 100% without a case unless waived)
        if (isFeatureEnabled(settings, 'backgroundVerification')
            && !workflow.backgroundVerificationCaseId
            && workflow.bgvStatus !== 'Waived') {
            workflow.bgvProgress = 0;
            workflow.bgvStatus = 'Not Started';
            workflow.bgvBlocksJoining = Boolean(settings.bgvPolicy?.blockJoiningUntilClear);
        }
    }
    const breakdown = calculateProgressBreakdown(workflow, settings);
    workflow.progressBreakdown = {
        tasks: breakdown.tasks,
        documents: breakdown.documents,
        checklist: breakdown.checklist,
        training: breakdown.training,
        policies: breakdown.policies,
        assets: breakdown.assets,
        forms: breakdown.forms,
        goals: breakdown.goals,
        bgv: breakdown.bgv,
        software: breakdown.software,
        byRole: breakdown.byRole,
    };
    workflow.progress = breakdown.overall;

    const terminal = ['Completed', 'Cancelled', 'Draft', 'Paused'];
    if (terminal.includes(workflow.status)) {
        if (workflow.status === 'Completed' && workflow.progress < 100) {
            workflow.status = 'In Progress';
            workflow.actualCompletionDate = undefined;
        } else {
            return workflow;
        }
    }

    if (workflow.expectedCompletionDate && startOfDay(workflow.expectedCompletionDate) < startOfDay(new Date())
        && !['Completed', 'Cancelled', 'Paused', 'Draft', 'Scheduled'].includes(workflow.status)) {
        workflow.status = 'Overdue';
    } else if (workflow.status === 'Overdue' && workflow.expectedCompletionDate
        && startOfDay(workflow.expectedCompletionDate) >= startOfDay(new Date())) {
        workflow.status = 'In Progress';
    }

    const canComplete = workflow.progress === 100
        && workflow.mandatoryFormsCompleted !== false
        && breakdown.bgvGateOpen !== false
        && ['Not Started', 'In Progress', 'Overdue', 'Scheduled'].includes(workflow.status);

    if (canComplete) {
        workflow.status = 'Completed';
        workflow.actualCompletionDate = new Date();
    } else if (['Not Started', 'Scheduled'].includes(workflow.status) && hasWorkflowActivity(workflow)) {
        // Pre-joining Scheduled workflows become active once work starts.
        workflow.status = 'In Progress';
        if (!workflow.startDate) workflow.startDate = new Date();
    }

    return workflow;
}

export function addActivity(workflow, { action, description, actor, actorName, metadata = {} }) {
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

async function resolveAssigneeByRole({ assigneeRole, employee, organizationId }) {
    switch (assigneeRole) {
        case 'employee':
            return employee._id;
        case 'manager':
            return employee.managerId || null;
        case 'hr': {
            const hr = await Employee.findOne({
                organizationId,
                status: 'active',
                $or: [
                    { department: /human resource/i },
                    { jobTitle: /hr/i },
                    { functionalRoles: 'hr' },
                ],
            }).select('_id').lean();
            return hr?._id || null;
        }
        case 'it': {
            const it = await Employee.findOne({
                organizationId,
                status: 'active',
                $or: [{ department: /it/i }, { jobTitle: /it/i }],
            }).select('_id').lean();
            return it?._id || null;
        }
        case 'payroll': {
            const payroll = await Employee.findOne({
                organizationId,
                status: 'active',
                $or: [{ department: /finance/i }, { jobTitle: /payroll/i }],
            }).select('_id').lean();
            return payroll?._id || null;
        }
        default:
            return null;
    }
}

async function getDefaultTemplate(organizationId) {
    await ensureDefaultOnboardingTemplate(organizationId);
    return resolveGatedOnboardingTemplate(organizationId);
}

export async function createEmployeeOnboardingWorkflow({
    employee,
    organizationId,
    assignedHR = null,
    assignedBuddy = null,
    assignedManager = null,
    templateId = null,
    initiatedBy = null,
    joiningDate = null,
    scheduledStartDate = null,
    status = null,
    welcomeMessage = null,
    asDraft = false,
}) {
    await assertModuleEnabled(organizationId, 'onboarding', 'Onboarding module');
    const existing = await OnboardingWorkflow.findOne({
        organizationId,
        employeeId: employee._id,
        isTemplate: { $ne: true },
    });
    if (existing) return existing;

    const orgSettings = await getOrgOnboardingSettings(organizationId);

    let template;
    const resolvedTemplateId = templateId || orgSettings.defaultTemplateId;
    if (resolvedTemplateId) {
        template = await resolveGatedOnboardingTemplate(organizationId, resolvedTemplateId);
    }
    if (!template) {
        template = await getDefaultTemplate(organizationId);
    }

    const effectiveJoining = joiningDate
        ? new Date(joiningDate)
        : (employee.dateOfJoining ? new Date(employee.dateOfJoining) : null);
    const effectiveScheduled = scheduledStartDate
        ? new Date(scheduledStartDate)
        : effectiveJoining;
    const startOnJoiningDate = Boolean(orgSettings.startWorkflowOnJoiningDate);
    let workflowStatus = asDraft
        ? 'Draft'
        : resolveInitialWorkflowStatus({
            joiningDate: effectiveJoining,
            scheduledStartDate: startOnJoiningDate ? effectiveScheduled : null,
            explicitStatus: status,
            startOnJoiningDate,
        });

    const now = new Date();
    const startDate = (workflowStatus === 'In Progress') ? (effectiveScheduled && isSameOrBeforeToday(effectiveScheduled) ? effectiveScheduled : now) : null;

    const expectedDays = template.expectedDays || 30;
    const expectedCompletionDate = new Date(effectiveScheduled || effectiveJoining || now);
    expectedCompletionDate.setDate(expectedCompletionDate.getDate() + expectedDays);

    const hrAssignee = assignedHR || await resolveAssigneeByRole({
        assigneeRole: 'hr',
        employee,
        organizationId,
    });

    const managerAssignee = assignedManager || employee.managerId || null;

    const roleCache = { hr: hrAssignee, employee: employee._id, manager: managerAssignee, buddy: assignedBuddy };
    const resolveCached = async (role) => {
        if (roleCache[role] !== undefined) return roleCache[role];
        roleCache[role] = await resolveAssigneeByRole({ assigneeRole: role, employee, organizationId });
        return roleCache[role];
    };

    const tasks = [];
    for (const taskDef of template.tasks || []) {
        const taskStart = startDate || effectiveScheduled || now;
        const dueDate = new Date(taskStart);
        dueDate.setDate(dueDate.getDate() + (taskDef.dueDaysFromStart || 7));

        let assignedTo = null;
        const role = taskDef.assigneeRole || 'employee';
        if (role === 'employee') assignedTo = employee._id;
        else if (role === 'manager') assignedTo = managerAssignee;
        else if (role === 'buddy') assignedTo = assignedBuddy;
        else if (role === 'hr') assignedTo = hrAssignee;
        else assignedTo = await resolveCached(role);

        if (assignedTo) {
            tasks.push({
                title: taskDef.title,
                description: taskDef.description,
                category: taskDef.category || 'Other',
                assigneeRole: taskDef.assigneeRole || 'employee',
                assignedTo,
                dueDate,
                priority: taskDef.priority || 'Medium',
                mandatory: taskDef.mandatory !== false,
                phase: taskDef.phase || 'Day 1',
                status: 'Pending',
                requiredDocuments: taskDef.requiredDocuments || [],
                requiresAllMandatoryDocsVerified: Boolean(taskDef.requiresAllMandatoryDocsVerified),
                featureKey: taskDef.featureKey || undefined,
            });
        }
    }

    const documents = (template.documents || []).map((doc) => ({
        documentType: doc.documentType,
        name: doc.name || doc.documentType,
        mandatory: doc.mandatory !== false,
        status: 'Pending',
        dueDate: dueDateFromPhase(startDate || effectiveScheduled || now, doc.phase, 7),
        featureKey: doc.featureKey || undefined,
    }));

    const checklist = (template.checklist || []).map((item) => ({
        item: item.item,
        category: item.category,
        phase: item.phase || 'Day 1',
        mandatory: item.mandatory !== false,
        assignedRole: item.assignedRole || ({
            HR: 'hr',
            IT: 'it',
            Payroll: 'payroll',
            Manager: 'manager',
            Buddy: 'buddy',
        }[item.category] || 'employee'),
        completed: false,
        dueDate: dueDateFromPhase(startDate || effectiveScheduled || now, item.phase, 7),
        featureKey: item.featureKey || undefined,
    }));

    const assets = (template.assets || []).map((a) => ({
        assetType: a.assetType,
        name: a.name,
        mandatory: a.mandatory !== false,
        status: 'Pending',
        featureKey: a.featureKey || 'itAssetProvisioning',
    }));

    const trainingModules = (template.trainingModules || [])
        .filter((t) => t.videoUrl || t.documentUrl || t.quizQuestions?.length)
        .map((t) => ({
        title: t.title,
        description: t.description,
        type: t.type,
        videoUrl: t.videoUrl,
        documentUrl: t.documentUrl,
        quizQuestions: t.quizQuestions || [],
        mandatory: t.mandatory !== false,
        passingScore: t.passingScore || 70,
        phase: t.phase || 'Week 1',
        dueDate: dueDateFromPhase(startDate || effectiveScheduled || now, t.phase || 'Week 1', 7),
        status: 'Not Started',
        featureKey: t.featureKey || 'mandatoryTraining',
        }));

    const policySignatures = (template.policySignatures || [])
        .filter((p) => p.documentUrl)
        .map((p) => ({
        documentType: p.documentType,
        title: p.title,
        documentUrl: p.documentUrl,
        mandatory: p.mandatory !== false,
        dueDate: dueDateFromPhase(startDate || effectiveScheduled || now, p.phase, 7),
        status: 'Pending',
        }));

    const lifecycleSettings = await getOrCreateLifecycleSettings(organizationId);
    const buddyCheckins = isFeatureEnabled(lifecycleSettings, 'buddyProgram')
        ? [
            { type: 'welcome_meeting', title: 'Buddy Welcome Meeting', status: 'Pending' },
            { type: 'first_week', title: 'First Week Check-in', status: 'Pending' },
            { type: 'day_30', title: '30-Day Check-in', status: 'Pending' },
        ]
        : [];

    const managerActions = [
        ...(isFeatureEnabled(lifecycleSettings, 'goalAssignment')
            ? [{ actionType: 'probation_goals', title: 'Approve Probation Goals', status: 'Pending' }]
            : []),
        { actionType: 'first_project', title: 'Assign First Project', status: 'Pending' },
        { actionType: 'one_on_one', title: 'Schedule 1:1 Meeting', status: 'Pending' },
        ...(isFeatureEnabled(lifecycleSettings, 'managerFeedback') || isFeatureEnabled(lifecycleSettings, 'probation')
            ? [{ actionType: 'review', title: 'Review Employee Progress', status: 'Pending' }]
            : []),
    ];

    const workflow = new OnboardingWorkflow({
        organizationId,
        employeeId: employee._id,
        templateId: template._id || templateId,
        startDate,
        joiningDate: effectiveJoining,
        scheduledStartDate: startOnJoiningDate ? effectiveScheduled : null,
        expectedCompletionDate,
        status: workflowStatus,
        welcomeMessage: welcomeMessage || template.welcomeMessage ||
            `Welcome ${employee.name}! We're thrilled to have you on the team.`,
        assignedHR: hrAssignee,
        assignedBuddy: assignedBuddy || null,
        assignedManager: managerAssignee,
        tasks,
        documents,
        checklist,
        assets,
        trainingModules,
        policySignatures,
        buddyCheckins,
        managerActions,
        activityFeed: [{
            action: workflowStatus === 'Draft' ? 'workflow_drafted' : workflowStatus === 'Scheduled' ? 'workflow_scheduled' : 'workflow_created',
            description: workflowStatus === 'Scheduled'
                ? `Onboarding scheduled for ${employee.name} on ${effectiveScheduled ? effectiveScheduled.toDateString() : 'joining date'}`
                : `Onboarding workflow created for ${employee.name} ${employee.lastName || ''}`,
            actor: initiatedBy,
            actorName: initiatedBy ? 'HR' : 'System',
            createdAt: new Date(),
        }, ...tasks.map((task) => ({
            action: 'task_assigned',
            description: `Task "${task.title}" assigned to ${task.assigneeRole}`,
            actor: initiatedBy,
            actorName: initiatedBy ? 'HR' : 'System',
            metadata: { taskId: task._id, assignedTo: task.assignedTo, assigneeRole: task.assigneeRole },
            createdAt: new Date(),
        }))],
    });

    await applyPackArtifactsToOnboardingWorkflow(workflow, organizationId);

    if (isFeatureEnabled(lifecycleSettings, 'milestone30_60_90')) {
        seedMilestonesForWorkflow(workflow, effectiveJoining);
    }
    // Probation is opt-in at employee create / Job Details — never auto-start for every hire
    if (
        isFeatureEnabled(lifecycleSettings, 'probation') &&
        employeeHasActiveProbation(employee)
    ) {
        initProbationForWorkflow(workflow, {
            joiningDate: effectiveJoining,
            probationMonths: resolveProbationMonthsFromEmployee(employee, 6),
            startDate: employee.probation?.startDate || null,
            endDate: employee.probation?.endDate || null,
        });
    }
    await syncFormGateToWorkflow(workflow, organizationId);
    if (isFeatureEnabled(lifecycleSettings, 'goalAssignment')) {
        await autoAssignDefaultProbationGoals(workflow, { actor: initiatedBy ? { _id: initiatedBy } : null });
        await syncGoalsProgressToWorkflow(workflow);
    }

    applyProgressToWorkflow(workflow, lifecycleSettings);
    await workflow.save();
    if (workflow.probation && employeeHasActiveProbation(employee)) {
        await syncEmployeeProbationFromWorkflow(workflow);
    }

    if (isFeatureEnabled(lifecycleSettings, 'backgroundVerification')) {
        try {
            const checkTypes = workflow.packBgvCheckTypes?.length
                ? workflow.packBgvCheckTypes
                : lifecycleSettings.bgvPolicy?.defaultChecks;
            const bgvCase = await createBgvCase({
                organizationId,
                subjectType: 'employee',
                employeeId: employee._id,
                onboardingWorkflowId: workflow._id,
                checkTypes,
                actor: initiatedBy ? { _id: initiatedBy } : null,
            });
            workflow.backgroundVerificationCaseId = bgvCase._id;
            await workflow.save();
        } catch (err) {
            logger.warn('BGV auto-create skipped', { error: err.message, employeeId: employee._id });
        }
    }

    emitOnboardingChangedAsync(organizationId, workflow._id);

    if (workflowStatus !== 'Draft') {
        runInBackground('onboarding-workflow-notify', async () => {
            await notify({
                type: 'onboarding_workflow_assigned',
                organizationId,
                data: { employee, workflow },
            });
            await Promise.all(workflow.tasks
                .filter((task) => task.assignedTo)
                .map((task) => notify({
                    type: 'onboarding_task_assigned',
                    organizationId,
                    data: { workflow, task },
                })));
        });
    }

    return workflow;
}

/** Activate workflows whose scheduled start date has arrived */
export async function activateScheduledWorkflows(organizationId = null) {
    const now = new Date();
    // Include joiningDate fallback and stuck Scheduled rows with no start date.
    const query = {
        status: 'Scheduled',
        isTemplate: { $ne: true },
        $or: [
            { scheduledStartDate: { $lte: now } },
            { scheduledStartDate: null, joiningDate: { $lte: now } },
            { scheduledStartDate: null, joiningDate: null },
            { scheduledStartDate: { $exists: false } },
        ],
    };
    if (organizationId) query.organizationId = organizationId;

    const workflows = await OnboardingWorkflow.find(query);
    let activated = 0;

    for (const workflow of workflows) {
        const start = workflow.scheduledStartDate || workflow.joiningDate;
        // Keep truly future-dated schedules waiting when only joiningDate is set.
        if (start && !isSameOrBeforeToday(start)) continue;

        workflow.status = 'Not Started';
        workflow.startDate = start || now;
        addActivity(workflow, {
            action: 'workflow_ready',
            description: 'Onboarding is ready to start on the employee joining date',
            actorName: 'System',
        });
        applyProgressToWorkflow(workflow);
        await workflow.save();
        emitOnboardingChangedAsync(workflow.organizationId, workflow._id);
        activated += 1;
    }

    return activated;
}

export function getOnboardingReminderStage(dueDate, now = new Date()) {
    if (!dueDate) return null;
    const due = startOfDay(dueDate);
    const today = startOfDay(now);
    const daysUntilDue = Math.round((due.getTime() - today.getTime()) / 86400000);
    if ([3, 1, 0].includes(daysUntilDue)) {
        return {
            key: daysUntilDue === 0 ? 'due-today' : `due-in-${daysUntilDue}-days`,
            wording: daysUntilDue === 0 ? 'is due today' : `is due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}`,
            priority: daysUntilDue === 0 ? 'high' : 'medium',
        };
    }
    if (daysUntilDue < 0) {
        return {
            key: `overdue-${localDateKey(today)}`,
            wording: 'is overdue',
            priority: 'high',
        };
    }
    return null;
}

function onboardingRoleRecipient(workflow, role = 'employee') {
    if (role === 'employee') return workflow.employeeId;
    if (role === 'hr') return workflow.assignedHR;
    if (role === 'manager') return workflow.assignedManager;
    if (role === 'buddy') return workflow.assignedBuddy;
    return (workflow.tasks || []).find((task) =>
        task.assigneeRole === role && task.assignedTo)?.assignedTo;
}

function buildOnboardingReminderItems(workflow, now) {
    const baseDate = workflow.startDate || workflow.scheduledStartDate
        || workflow.joiningDate || workflow.createdAt || now;
    const records = [];
    const add = ({ kind, item, label, dueDate, recipient, title }) => {
        const stage = getOnboardingReminderStage(dueDate, now);
        if (!stage || !recipient) return;
        records.push({
            key: `${kind}:${item._id}:${stage.key}`,
            eventType: 'onboarding_reminder',
            recipient,
            title,
            message: `${label} ${stage.wording}. Please complete it as soon as possible.`,
            item,
            reminderType: kind,
            dueDate,
            priority: stage.priority,
        });
    };

    for (const task of workflow.tasks || []) {
        if (['Completed', 'Cancelled'].includes(task.status)) continue;
        add({
            kind: 'task', item: task, label: `Onboarding task "${task.title}"`,
            dueDate: task.dueDate, recipient: task.assignedTo,
            title: task.status === 'Overdue' ? 'Onboarding Task Overdue' : 'Pending Task Reminder',
        });
    }
    for (const doc of workflow.documents || []) {
        if (doc.mandatory === false || ['Uploaded', 'Verified'].includes(doc.status)) continue;
        if (!doc.dueDate) doc.dueDate = dueDateFromPhase(baseDate, null, 7);
        add({
            kind: 'document', item: doc, label: `Required document "${doc.name || doc.documentType}"`,
            dueDate: doc.dueDate, recipient: workflow.employeeId, title: 'Pending Document Reminder',
        });
    }
    for (const item of workflow.checklist || []) {
        if (item.mandatory === false || item.completed) continue;
        if (!item.dueDate) item.dueDate = dueDateFromPhase(baseDate, item.phase, 7);
        add({
            kind: 'checklist', item, label: `Checklist item "${item.item}"`,
            dueDate: item.dueDate, recipient: onboardingRoleRecipient(workflow, item.assignedRole),
            title: 'Pending Checklist Reminder',
        });
    }
    for (const module of workflow.trainingModules || []) {
        if (module.mandatory === false || module.status === 'Completed') continue;
        if (!module.dueDate) module.dueDate = dueDateFromPhase(baseDate, module.phase, 7);
        add({
            kind: 'training', item: module, label: `Training module "${module.title}"`,
            dueDate: module.dueDate, recipient: workflow.employeeId, title: 'Pending Training Reminder',
        });
    }
    for (const signature of workflow.policySignatures || []) {
        if (signature.mandatory === false || signature.status === 'Signed') continue;
        if (!signature.dueDate) signature.dueDate = dueDateFromPhase(baseDate, null, 7);
        add({
            kind: 'policy', item: signature, label: `Policy "${signature.title}"`,
            dueDate: signature.dueDate, recipient: workflow.employeeId,
            title: 'Pending Policy Signature Reminder',
        });
    }
    return records;
}

/**
 * Reconcile time-driven onboarding state from persisted dates and completion data.
 * This is safe to run repeatedly: transitions are logged/notified only once.
 */
export async function synchronizeOnboardingWorkflows(organizationId = null) {
    const retiredTaskScope = organizationId ? { organizationId } : {};
    await Promise.all([
        OnboardingWorkflow.updateMany(
            { ...retiredTaskScope, 'tasks.title': { $in: RETIRED_DEFAULT_TASK_TITLES } },
            { $pull: { tasks: { title: { $in: RETIRED_DEFAULT_TASK_TITLES } } } },
        ),
        OnboardingTemplate.updateMany(
            { ...retiredTaskScope, 'tasks.title': { $in: RETIRED_DEFAULT_TASK_TITLES } },
            { $pull: { tasks: { title: { $in: RETIRED_DEFAULT_TASK_TITLES } } } },
        ),
    ]);

    await activateScheduledWorkflows(organizationId);

    const now = new Date();
    const query = {
        isTemplate: { $ne: true },
    };
    if (organizationId) query.organizationId = organizationId;

    const workflows = await OnboardingWorkflow.find(query)
        .populate('employeeId', 'name lastName employeeId');
    const result = { workflowsChecked: workflows.length, tasksOverdue: 0, remindersSent: 0, workflowsCompleted: 0, escalationsSent: 0 };
    await synchronizeWorkflowDocuments(workflows);

    const settingsByOrg = new Map();
    const getSettings = async (orgId) => {
        const key = String(orgId);
        if (!settingsByOrg.has(key)) {
            settingsByOrg.set(key, await getOrCreateLifecycleSettings(orgId));
        }
        return settingsByOrg.get(key);
    };

    for (const workflow of workflows) {
        const lifecycleSettings = await getSettings(workflow.organizationId);
        await syncFormGateToWorkflow(workflow, workflow.organizationId);
        await syncGoalsProgressToWorkflow(workflow);
        const overdueTasks = [];
        const previousStatus = workflow.status;
        if (workflow.status === 'On Hold') {
            workflow.status = 'Paused';
            workflow.pausedFromStatus = 'In Progress';
        }
        const previousProgress = workflow.progress;
        const previousBreakdown = JSON.stringify(workflow.progressBreakdown?.toObject?.()
            || workflow.progressBreakdown || {});
        const automationActive = ['Not Started', 'In Progress', 'Overdue', 'Completed']
            .includes(workflow.status);

        for (const task of automationActive ? (workflow.tasks || []) : []) {
            const isOpen = !['Completed', 'Cancelled'].includes(task.status);
            if (!isOpen || !task.dueDate) continue;

            const dueDate = new Date(task.dueDate);
            if (startOfDay(dueDate) < startOfDay(now) && task.status !== 'Overdue') {
                task.status = 'Overdue';
                task.overdueAt = now;
                overdueTasks.push(task);
                result.tasksOverdue += 1;
                addActivity(workflow, {
                    action: 'task_overdue',
                    description: (() => {
                        const emp = workflow.employeeId;
                        const empName = emp && typeof emp === 'object'
                            ? `${emp.name || ''} ${emp.lastName || ''}`.trim()
                            : '';
                        const taskLabel = `Task "${task.title}" became overdue`;
                        return empName ? `${empName}: ${taskLabel}` : taskLabel;
                    })(),
                    actorName: 'System',
                    metadata: {
                        taskId: task._id,
                        dueDate: task.dueDate,
                        employeeId: workflow.employeeId?._id || workflow.employeeId,
                    },
                });
            }
        }

        const { restoreEnabledPackArtifacts, applyOnboardingFeatureGates } = await import('./lifecycleFeatureRuntimeService.js');
        applyOnboardingFeatureGates(workflow, lifecycleSettings);
        await restoreEnabledPackArtifacts(workflow, workflow.organizationId, lifecycleSettings, 'onboarding');
        // Re-apply after pack restore so Configure document overrides stay in effect
        applyOnboardingFeatureGates(workflow, lifecycleSettings);
        applyProgressToWorkflow(workflow, lifecycleSettings);
        if (previousStatus !== 'Completed' && workflow.status === 'Completed') {
            workflow.completionNotifiedAt = now;
            result.workflowsCompleted += 1;
            addActivity(workflow, {
                action: 'workflow_completed',
                description: (() => {
                    const emp = workflow.employeeId;
                    const empName = emp && typeof emp === 'object'
                        ? `${emp.name || ''} ${emp.lastName || ''}`.trim()
                        : '';
                    const msg = 'All mandatory onboarding requirements completed';
                    return empName ? `${empName}: ${msg}` : msg;
                })(),
                actorName: 'System',
                metadata: {
                    progress: workflow.progress,
                    employeeId: workflow.employeeId?._id || workflow.employeeId,
                },
            });
        }

        if (!workflow.notificationHistory) workflow.notificationHistory = [];
        const remindersEnabled = isFeatureEnabled(lifecycleSettings, 'reminders');
        const sentReminderKeys = new Set(workflow.notificationHistory.map((entry) => entry.key));
        const pendingNotifications = (automationActive && remindersEnabled)
            ? buildOnboardingReminderItems(workflow, now)
                .filter((reminder) => !sentReminderKeys.has(reminder.key))
            : [];

        const todayKey = localDateKey(startOfDay(now));
        const workflowOverdueKey = `workflow-overdue:${todayKey}`;
        if (remindersEnabled && automationActive && workflow.status === 'Overdue' && !sentReminderKeys.has(workflowOverdueKey)) {
            pendingNotifications.push({
                key: workflowOverdueKey,
                eventType: 'onboarding_workflow_overdue',
            });
        }

        for (const notification of pendingNotifications) {
            workflow.notificationHistory.push({
                key: notification.key,
                eventType: notification.eventType,
                sentAt: now,
            });
        }
        result.remindersSent += pendingNotifications.length;

        const { processLifecycleEscalations, collectOverdueOnboardingItems } = await import('./lifecycleEscalationService.js');
        const escalationResult = await processLifecycleEscalations({
            organizationId: workflow.organizationId,
            workflow,
            module: 'onboarding',
            overdueItems: collectOverdueOnboardingItems(workflow, now),
            now,
        });
        result.escalationsSent = (result.escalationsSent || 0) + escalationResult.escalationsSent;

        workflow.lastAutomationRunAt = now;

        const changed = overdueTasks.length || pendingNotifications.length
            || previousStatus !== workflow.status || previousProgress !== workflow.progress
            || workflow.isModified('tasks') || workflow.isModified('documents')
            || workflow.isModified('checklist') || workflow.isModified('trainingModules')
            || workflow.isModified('policySignatures')
            || previousBreakdown !== JSON.stringify(workflow.progressBreakdown?.toObject?.()
                || workflow.progressBreakdown || {});
        if (!changed) continue;

        try {
            await workflow.save();
        } catch (err) {
            logger.error('Onboarding workflow sync save failed', {
                workflowId: String(workflow._id),
                organizationId: String(workflow.organizationId),
                message: err.message,
            });
            continue;
        }

        // Only broadcast for real lifecycle events — not silent progress recalcs on GET
        const shouldBroadcast = overdueTasks.length
            || previousStatus !== workflow.status;
        if (shouldBroadcast) emitOnboardingChangedAsync(workflow.organizationId, workflow._id);

        runInBackground('onboarding-automation-notifications', async () => {
            await Promise.all([
                ...pendingNotifications.map((notification) => notify({
                    type: notification.eventType,
                    organizationId: workflow.organizationId,
                    title: notification.title,
                    message: notification.message,
                    priority: notification.priority,
                    data: {
                        workflow,
                        recipient: notification.recipient,
                        item: notification.item,
                        reminderType: notification.reminderType,
                        dueDate: notification.dueDate,
                    },
                })),
                ...(previousStatus !== 'Completed' && workflow.status === 'Completed'
                    ? [notify({
                        type: 'onboarding_workflow_completed',
                        organizationId: workflow.organizationId,
                        data: { workflow },
                    })]
                    : []),
            ]);
        });
    }

    return result;
}

export async function buildEnhancedDashboardStats(organizationId) {
    const today = startOfDay(new Date());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

    const base = { organizationId, isTemplate: { $ne: true } };
    const workflowRecords = await OnboardingWorkflow.find(base)
        .populate('employeeId', '_id')
        .lean();
    const workflows = workflowRecords.filter((workflow) => workflow.employeeId);
    const uniqueEmployeeCount = (rows) => new Set(rows
        .map((workflow) => (workflow.employeeId?._id || workflow.employeeId)?.toString())
        .filter(Boolean)).size;

    const countPendingDocs = (w) => (w.documents || []).filter((d) =>
        d.mandatory !== false && !['Verified'].includes(d.status)).length;

    const pendingHrTasks = (w) => (w.tasks || []).filter((t) =>
        t.assigneeRole === 'hr' && t.status !== 'Completed').length;

    const pendingItTasks = (w) => (w.tasks || []).filter((t) =>
        (t.assigneeRole === 'it' || t.category === 'IT Setup' || t.category === 'Equipment') && t.status !== 'Completed').length;

    const pendingManagerTasks = (w) => (w.tasks || []).filter((t) =>
        t.assigneeRole === 'manager' && t.status !== 'Completed').length;

    const pendingPayrollTasks = (w) => (w.tasks || []).filter((t) =>
        t.assigneeRole === 'payroll' && t.status !== 'Completed').length;

    const isDelayed = (w) => w.status === 'Overdue'
        || (w.expectedCompletionDate && new Date(w.expectedCompletionDate) < new Date()
            && !['Completed', 'Cancelled', 'Draft', 'Scheduled', 'Paused'].includes(w.status));

    return {
        totalJoinings: uniqueEmployeeCount(workflows),
        active: workflows.filter((w) => w.status === 'In Progress').length,
        completed: workflows.filter((w) => w.status === 'Completed').length,
        delayed: workflows.filter(isDelayed).length,
        notStarted: workflows.filter((w) => ['Not Started', 'Draft'].includes(w.status)).length,
        scheduled: workflows.filter((w) => w.status === 'Scheduled').length,
        paused: workflows.filter((w) => ['Paused', 'On Hold'].includes(w.status)).length,
        todaysJoinings: uniqueEmployeeCount(workflows.filter((w) => {
            if (!w.joiningDate) return false;
            const jd = startOfDay(new Date(w.joiningDate));
            return jd.getTime() === today.getTime();
        })),
        upcomingJoinings: uniqueEmployeeCount(workflows.filter((w) => {
            if (!w.joiningDate) return false;
            const jd = startOfDay(new Date(w.joiningDate));
            return jd > today && jd <= new Date(today.getTime() + 30 * 86400000);
        })),
        pendingDocuments: workflows.reduce((sum, w) => sum + countPendingDocs(w), 0),
        pendingHrTasks: workflows.reduce((sum, w) => sum + pendingHrTasks(w), 0),
        pendingItSetup: workflows.reduce((sum, w) => sum + pendingItTasks(w), 0),
        pendingPayrollTasks: workflows.reduce((sum, w) => sum + pendingPayrollTasks(w), 0),
        pendingManagerReviews: workflows.reduce((sum, w) => sum + pendingManagerTasks(w), 0),
        pendingVerifications: workflows.reduce((sum, w) =>
            sum + (w.documents || []).filter((d) => d.status === 'Uploaded').length, 0),
        delayedEmployees: workflows.filter(isDelayed).length,
        completedThisMonth: workflows.filter((w) =>
            w.status === 'Completed' && w.actualCompletionDate
            && new Date(w.actualCompletionDate) >= monthStart
            && new Date(w.actualCompletionDate) <= monthEnd).length,
    };
}

export function buildRoleDashboardStats(workflows, roleCtx, view = '') {
    const rows = (workflows || []).filter((workflow) => workflow.employeeId);
    const openTasks = rows.flatMap((workflow) =>
        (workflow.tasks || []).filter((task) => !['Completed', 'Cancelled'].includes(task.status)));

    const preferBuddy = view === 'buddy'
        || (roleCtx.hasBuddyAssignments && view !== 'team' && view !== 'tasks' && !roleCtx.hasTeamOnboarding && !roleCtx.canViewTasks);
    const preferManager = view === 'team' || view === 'tasks'
        || ((roleCtx.hasTeamOnboarding || roleCtx.canViewTasks || roleCtx.hasDirectReports)
            && view !== 'buddy' && !preferBuddy);

    if (preferManager) {
        const managerTasks = openTasks.filter((task) => task.assigneeRole === 'manager');
        return {
            assignedEmployees: rows.length,
            pendingReviews: rows.reduce((sum, workflow) =>
                sum + (workflow.managerActions || []).filter((action) => action.status !== 'Completed').length, 0),
            pendingInduction: managerTasks.filter((task) => task.category === 'Orientation').length,
            pendingGoals: rows.reduce((sum, workflow) =>
                sum + (workflow.managerActions || []).filter((action) =>
                    action.actionType === 'probation_goals' && action.status !== 'Completed').length, 0),
            teamAverageProgress: rows.length
                ? Math.round(rows.reduce((sum, workflow) => sum + (workflow.progress || 0), 0) / rows.length)
                : 0,
        };
    }

    if (preferBuddy || roleCtx.hasBuddyAssignments || roleCtx.isBuddy) {
        const pendingCheckins = (type) => rows.reduce((sum, workflow) =>
            sum + (workflow.buddyCheckins || []).filter((checkin) =>
                checkin.type === type && checkin.status !== 'Completed').length, 0);
        return {
            assignedEmployees: rows.length,
            welcomeMeetings: pendingCheckins('welcome_meeting'),
            firstWeekCheckins: pendingCheckins('first_week'),
            day30Followups: pendingCheckins('day_30'),
        };
    }

    return {
        pendingTasks: openTasks.length,
        progress: rows[0]?.progress || 0,
        upcomingTasks: openTasks.filter((task) => task.dueDate && new Date(task.dueDate) >= new Date()).length,
    };
}

/** Fallback rules for workflows created before requiredDocuments was stored on tasks */
const TASK_TITLE_COMPLETION_FALLBACK = {
    'Upload identity documents': { requiredDocuments: ['AADHAAR', 'PAN', 'PHOTO'] },
    'Upload bank details': { requiredDocuments: ['BANK_DETAILS'] },
    'Verify employee documents': { requiresAllMandatoryDocsVerified: true },
};

const DOC_LABELS = Object.fromEntries(
    ONBOARDING_DOCUMENT_TYPES.map((d) => [d.key, d.label])
);

function resolveTaskCompletionRules(task) {
    const fallback = TASK_TITLE_COMPLETION_FALLBACK[task.title] || {};
    return {
        requiredDocuments: task.requiredDocuments?.length
            ? task.requiredDocuments
            : (fallback.requiredDocuments || []),
        requiresAllMandatoryDocsVerified: task.requiresAllMandatoryDocsVerified
            || fallback.requiresAllMandatoryDocsVerified
            || false,
    };
}

function getWorkflowDocument(workflow, documentType) {
    return (workflow.documents || []).find((d) => d.documentType === documentType);
}

function isDocUploaded(doc) {
    return Boolean(doc?.url) && ['Uploaded', 'Verified'].includes(doc?.status);
}

function isDocVerified(doc) {
    return doc?.status === 'Verified';
}

/**
 * Keep document-dependent tasks aligned with canonical Employee Documents.
 * Upload tasks complete when all of their required documents are uploaded,
 * while verification tasks complete only after every mandatory document is verified.
 */
export function synchronizeDocumentDrivenTasks(workflow, now = new Date()) {
    let changed = false;

    for (const task of workflow.tasks || []) {
        if (task.status === 'Cancelled') continue;

        const rules = resolveTaskCompletionRules(task);
        const isDocumentTask = rules.requiredDocuments.length > 0
            || rules.requiresAllMandatoryDocsVerified;
        if (!isDocumentTask) continue;

        const requiredDocs = rules.requiresAllMandatoryDocsVerified
            ? (workflow.documents || []).filter((doc) => doc.mandatory !== false)
            : rules.requiredDocuments.map((type) => getWorkflowDocument(workflow, type));
        const dependenciesComplete = (task.dependencies || []).every((dependencyId) => {
            const dependency = (workflow.tasks || []).find((candidate) =>
                candidate._id?.toString() === dependencyId?.toString());
            return dependency?.status === 'Completed';
        });
        const requirementsComplete = requiredDocs.length > 0 && (
            rules.requiresAllMandatoryDocsVerified
                ? requiredDocs.every(isDocVerified)
                : requiredDocs.every(isDocUploaded)
        );
        const hasDocumentActivity = requiredDocs.some((doc) =>
            doc?.url || ['Uploaded', 'Verified', 'Rejected'].includes(doc?.status));
        const isPastDue = task.dueDate && startOfDay(task.dueDate) < startOfDay(now);

        const nextStatus = requirementsComplete && dependenciesComplete
            ? 'Completed'
            : isPastDue
                ? 'Overdue'
                : hasDocumentActivity
                    ? 'In Progress'
                    : 'Pending';

        if (task.status === nextStatus) continue;

        const previousStatus = task.status;
        task.status = nextStatus;
        if (nextStatus === 'Completed') {
            if (!task.startedDate) task.startedDate = now;
            task.completedDate = now;
            task.overdueAt = undefined;
        } else {
            task.completedDate = undefined;
            if (nextStatus === 'Pending') {
                task.startedDate = undefined;
                task.overdueAt = undefined;
            } else {
                if (!task.startedDate) task.startedDate = now;
                if (nextStatus === 'Overdue' && !task.overdueAt) task.overdueAt = now;
                if (nextStatus !== 'Overdue') task.overdueAt = undefined;
            }
        }

        addActivity(workflow, {
            action: 'document_task_status_changed',
            description: `Task "${task.title}" automatically changed from ${previousStatus} to ${nextStatus}`,
            actorName: 'System',
            metadata: { taskId: task._id, previousStatus, status: nextStatus },
        });
        changed = true;
    }

    return changed;
}

/**
 * Returns human-readable blockers preventing task completion.
 * Empty array means the task can be marked complete.
 */
export function getTaskCompletionBlockers(workflow, task) {
    const blockers = [];

    if (task.status === 'Completed') return blockers;

    if (task.status === 'Pending') {
        blockers.push('Start the task before marking it complete');
        return blockers;
    }

    const rules = resolveTaskCompletionRules(task);

    for (const dependencyId of task.dependencies || []) {
        const dependency = (workflow.tasks || []).find((candidate) =>
            candidate._id?.toString() === dependencyId?.toString());
        if (!dependency || dependency.status !== 'Completed') {
            blockers.push(`Complete dependency: ${dependency?.title || 'required task'}`);
        }
    }

    for (const docType of rules.requiredDocuments) {
        const doc = getWorkflowDocument(workflow, docType);
        if (!isDocUploaded(doc)) {
            blockers.push(`Upload ${DOC_LABELS[docType] || docType}`);
        }
    }

    if (rules.requiresAllMandatoryDocsVerified) {
        const mandatoryDocs = (workflow.documents || []).filter((d) => d.mandatory !== false);
        const unverified = mandatoryDocs.filter((d) => !isDocVerified(d));
        for (const doc of unverified) {
            const label = DOC_LABELS[doc.documentType] || doc.name || doc.documentType;
            if (!doc.url || doc.status === 'Pending') {
                blockers.push(`Waiting for employee to upload ${label}`);
            } else if (doc.status === 'Uploaded') {
                blockers.push(`Verify ${label}`);
            } else if (doc.status === 'Rejected') {
                blockers.push(`${label} was rejected — ask employee to re-upload`);
            } else {
                blockers.push(`Verify ${label}`);
            }
        }
    }

    return blockers;
}

export function canCompleteTask(workflow, task) {
    return getTaskCompletionBlockers(workflow, task).length === 0;
}

export function filterTasksForUser(workflow, userId, { isHR, isAdmin, isManager, isBuddy, employeeId }) {
    if (isHR || isAdmin) return workflow.tasks || [];

    return (workflow.tasks || []).filter((task) => {
        const assignedId = task.assignedTo?._id?.toString() || task.assignedTo?.toString();
        if (assignedId === userId?.toString()) return true;
        if (isManager && task.assigneeRole === 'manager' && workflow.assignedManager?.toString() === userId?.toString()) return true;
        if (isBuddy && task.assigneeRole === 'buddy' && workflow.assignedBuddy?.toString() === userId?.toString()) return true;
        if (employeeId && task.assigneeRole === 'employee' && workflow.employeeId?.toString() === employeeId?.toString()) return true;
        return false;
    });
}

export async function resolveEmployeeIdFromRequest(req) {
    const organizationId = req.user?.organizationId || req.employee?.organizationId;
    if (req.employee?._id) return req.employee._id;
    if (req.user?.employeeId) return req.user.employeeId;
    if (req.user?._id && organizationId) {
        // Prefer active, but still resolve onboarding for probation/inactive joiners.
        let emp = await Employee.findOne({
            userId: req.user._id,
            organizationId,
            status: 'active',
        }).select('_id').lean();
        if (!emp) {
            emp = await Employee.findOne({
                userId: req.user._id,
                organizationId,
            }).select('_id').lean();
        }
        if (emp?._id) return emp._id;
    }
    return null;
}

export async function getOnboardingRoleContext(req) {
    const employeeId = await resolveEmployeeIdFromRequest(req);
    const userId = req.employee?._id || employeeId || req.user?._id;
    const organizationId = req.user?.organizationId || req.employee?.organizationId;

    const isAdmin = req.user?.role === 'admin' || req.authContext?.isOrgOwner;
    const isHR = req.authContext?.isHrManager || req.authContext?.isHrExecutive ||
        (req.employee?.department || '').toLowerCase().includes('human resource');

    let isManager = false;
    let isBuddy = false;
    let hasTeamOnboarding = false;
    let hasBuddyAssignments = false;
    const isLineManager = Boolean(req.authContext?.isLineManager);

    if (employeeId) {
        const buddyIds = [employeeId];
        if (userId && String(userId) !== String(employeeId)) buddyIds.push(userId);

        const buddyWorkflows = await OnboardingWorkflow.countDocuments({
            organizationId,
            isTemplate: { $ne: true },
            status: { $nin: ['Cancelled'] },
            $or: [
                { assignedBuddy: { $in: buddyIds } },
                {
                    tasks: {
                        $elemMatch: {
                            assigneeRole: 'buddy',
                            assignedTo: { $in: buddyIds },
                        },
                    },
                },
            ],
        });
        hasBuddyAssignments = buddyWorkflows > 0;
        isBuddy = hasBuddyAssignments;

        const managerWorkflows = await OnboardingWorkflow.countDocuments({
            organizationId,
            assignedManager: { $in: buddyIds },
            isTemplate: { $ne: true },
            status: { $nin: ['Cancelled'] },
        });
        hasTeamOnboarding = managerWorkflows > 0;
        isManager = hasTeamOnboarding || isLineManager;
    }

    return {
        employeeId,
        userId,
        organizationId,
        isAdmin,
        isHR,
        isManager,
        isBuddy,
        isLineManager,
        hasTeamOnboarding,
        hasBuddyAssignments,
    };
}
