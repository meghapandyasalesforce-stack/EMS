/**
 * Enterprise lifecycle extensions — milestones, probation, alumni, bootstrap, adapters.
 */

import { OnboardingWorkflow } from '../../models/onboarding.model.js';
import { getOrganizationId } from '../../helpers/organizationHelper.js';
import { bootstrapEnterpriseLifecycle } from '../../services/lifecycleEnterpriseBootstrap.js';
import { autoConfigureLifecyclePacks } from '../../services/lifecycleCountryAutoConfigService.js';
import {
    submitMilestoneReview, buildMilestoneDashboard, syncMilestoneOverdue,
} from '../../services/lifecycleMilestoneService.js';
import {
    extendProbation, submitProbationReview, buildProbationDashboard,
} from '../../services/lifecycleProbationService.js';
import {
    listAlumni, blacklistAlumni, initiateRehire, buildAlumniDashboard,
} from '../../services/lifecycleAlumniService.js';
import { revokeAllMandatoryAccess, listAccessRevocationAdapters } from '../../services/accessRevocationAdapter.js';
import { listLmsProviders, syncWorkflowTrainingFromLms } from '../../services/lmsAdapter.js';
import { listEsignProviders } from '../../services/esignAdapter.js';
import { listBgvVendors } from '../../services/backgroundVerificationService.js';
import { saveOffboardingWorkflow } from '../../services/offboardingService.js';
import { OffboardingWorkflow } from '../../models/onboarding.model.js';
import Employee from '../../models/employee.model.js';
import { logLifecycleAudit } from '../../services/lifecycleAuditService.js';
import { getFormCompletionStatus, syncFormGateToWorkflow } from '../../services/lifecycleFormGateService.js';
import {
    assignOnboardingGoals, getOnboardingGoals, syncGoalsProgressToWorkflow,
} from '../../services/lifecycleGoalIntegrationService.js';
import { createFnfPayrollRun } from '../../services/fnfPayrollBridgeService.js';
import { listGeneratedLettersForWorkflow } from '../../services/lifecycleLetterAutomationService.js';
import { applyProgressToWorkflow } from '../../services/onboardingService.js';

const orgId = (req) => getOrganizationId(req);
const actor = (req) => req.employee || req.user;

export const postEnterpriseBootstrap = async (req, res) => {
    try {
        const result = await bootstrapEnterpriseLifecycle(orgId(req), { actor: actor(req), req });
        return res.json({ success: true, data: result, message: 'Enterprise lifecycle bootstrapped' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const postAutoConfigurePacks = async (req, res) => {
    try {
        const result = await autoConfigureLifecyclePacks(orgId(req), { actor: actor(req), req });
        return res.json({ success: true, data: result });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const getAdapterCatalog = async (_req, res) => {
    return res.json({
        success: true,
        data: {
            esign: listEsignProviders(),
            bgv: listBgvVendors(),
            lms: listLmsProviders(),
            accessRevocation: listAccessRevocationAdapters(),
        },
    });
};

async function loadOnboarding(organizationId, workflowId) {
    const wf = await OnboardingWorkflow.findOne({ _id: workflowId, organizationId, isTemplate: { $ne: true } });
    if (!wf) {
        const err = new Error('Onboarding workflow not found');
        err.statusCode = 404;
        throw err;
    }
    return wf;
}

export const postMilestoneReview = async (req, res) => {
    try {
        const workflow = await loadOnboarding(orgId(req), req.params.workflowId);
        await submitMilestoneReview(workflow, { day: Number(req.body.day), ...req.body }, { actor: actor(req), req });
        syncMilestoneOverdue(workflow);
        await workflow.save();
        return res.json({ success: true, data: workflow.milestones });
    } catch (error) {
        return res.status(error.statusCode || 400).json({ success: false, message: error.message });
    }
};

export const postProbationExtend = async (req, res) => {
    try {
        const workflow = await loadOnboarding(orgId(req), req.params.workflowId);
        await extendProbation(workflow, req.body, { actor: actor(req), req });
        await workflow.save();
        return res.json({ success: true, data: workflow.probation });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const postProbationReview = async (req, res) => {
    try {
        const workflow = await loadOnboarding(orgId(req), req.params.workflowId);
        await submitProbationReview(workflow, req.body, { actor: actor(req), req });
        await workflow.save();
        return res.json({ success: true, data: workflow.probation });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const getAlumniList = async (req, res) => {
    try {
        const records = await listAlumni(orgId(req), req.query);
        return res.json({ success: true, data: records, dashboard: buildAlumniDashboard(records) });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const postAlumniBlacklist = async (req, res) => {
    try {
        const record = await blacklistAlumni(orgId(req), req.params.alumniId, {
            reason: req.body.reason, actor: actor(req), req,
        });
        return res.json({ success: true, data: record });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const postAlumniRehire = async (req, res) => {
    try {
        const result = await initiateRehire(orgId(req), req.params.alumniId, {
            notes: req.body.notes, actor: actor(req), req,
        });
        return res.json({ success: true, data: result });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const postAutoRevokeAccess = async (req, res) => {
    try {
        const workflow = await OffboardingWorkflow.findOne({ _id: req.params.workflowId, organizationId: orgId(req) });
        if (!workflow) return res.status(404).json({ success: false, message: 'Workflow not found' });
        const employee = await Employee.findById(workflow.employeeId).lean();
        const results = await revokeAllMandatoryAccess(workflow, employee);
        await saveOffboardingWorkflow(workflow, orgId(req), { actor: actor(req) });
        await logLifecycleAudit({
            action: 'Update', entityType: 'Offboarding', entityId: workflow._id,
            entityName: 'Auto Access Revocation', actor: actor(req), req,
        });
        return res.json({ success: true, data: results });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const postSyncLmsTraining = async (req, res) => {
    try {
        const workflow = await loadOnboarding(orgId(req), req.params.workflowId);
        const { provider, lmsCourseMap } = req.body;
        await syncWorkflowTrainingFromLms(workflow, { provider, lmsCourseMap });
        await workflow.save();
        return res.json({ success: true, data: workflow.trainingModules });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const getMilestoneDashboard = async (req, res) => {
    try {
        const workflows = await OnboardingWorkflow.find({ organizationId: orgId(req), isTemplate: { $ne: true } }).lean();
        return res.json({ success: true, data: buildMilestoneDashboard(workflows) });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const getProbationDashboard = async (req, res) => {
    try {
        const workflows = await OnboardingWorkflow.find({ organizationId: orgId(req), isTemplate: { $ne: true } }).lean();
        return res.json({ success: true, data: buildProbationDashboard(workflows) });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const getFormGateStatus = async (req, res) => {
    try {
        const organizationId = orgId(req);
        const workflow = await loadOnboarding(organizationId, req.params.workflowId);
        const status = await getFormCompletionStatus(organizationId, {
            employeeId: workflow.employeeId,
            workflowId: workflow._id,
        });
        return res.json({ success: true, data: status });
    } catch (error) {
        return res.status(error.statusCode || 400).json({ success: false, message: error.message });
    }
};

export const getOnboardingGoalsHandler = async (req, res) => {
    try {
        const workflow = await loadOnboarding(orgId(req), req.params.workflowId);
        const goals = await getOnboardingGoals(workflow);
        return res.json({ success: true, data: goals });
    } catch (error) {
        return res.status(error.statusCode || 400).json({ success: false, message: error.message });
    }
};

export const postAssignOnboardingGoals = async (req, res) => {
    try {
        const workflow = await loadOnboarding(orgId(req), req.params.workflowId);
        const { goals } = req.body;
        const { goals: created } = await assignOnboardingGoals(workflow, goals || [], { actor: actor(req), req });
        await syncGoalsProgressToWorkflow(workflow);
        applyProgressToWorkflow(workflow);
        await workflow.save();
        return res.json({ success: true, data: { goals: created, workflow: { goalsProgress: workflow.goalsProgress } } });
    } catch (error) {
        return res.status(error.statusCode || 400).json({ success: false, message: error.message });
    }
};

export const postFnfPayrollBridge = async (req, res) => {
    try {
        const workflow = await OffboardingWorkflow.findOne({ _id: req.params.workflowId, organizationId: orgId(req) });
        if (!workflow) return res.status(404).json({ success: false, message: 'Workflow not found' });
        const result = await createFnfPayrollRun(workflow, { actor: actor(req), req, ...req.body });
        await saveOffboardingWorkflow(workflow, orgId(req), { actor: actor(req) });
        return res.json({ success: true, data: result });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const getOffboardingGeneratedLetters = async (req, res) => {
    try {
        const letters = await listGeneratedLettersForWorkflow(orgId(req), req.params.workflowId);
        return res.json({ success: true, data: letters });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const refreshOnboardingProgress = async (req, res) => {
    try {
        const workflow = await loadOnboarding(orgId(req), req.params.workflowId);
        await syncFormGateToWorkflow(workflow, orgId(req));
        await syncGoalsProgressToWorkflow(workflow);
        applyProgressToWorkflow(workflow);
        await workflow.save();
        return res.json({ success: true, data: workflow });
    } catch (error) {
        return res.status(error.statusCode || 400).json({ success: false, message: error.message });
    }
};
