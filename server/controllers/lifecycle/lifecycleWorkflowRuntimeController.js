/**
 * Workflow Runtime Controller - Stage execution, dependencies, approvals, conditional visibility, auto progression
 */

import { getOrganizationId } from '../../helpers/organizationHelper.js';
import { OnboardingWorkflow, OffboardingWorkflow } from '../../models/onboarding.model.js';
import {
    updateStageState,
    autoProgressStages,
    progressToNextStage,
    getStageSummary,
    initializeOnboardingStages,
    initializeOffboardingStages,
    isWorkflowBlocked,
    getBlockingStages,
    unblockStage,
    skipStage,
    calculateStageProgress,
    getStageTimeline,
    validateStageConfiguration,
    canProgressToNextStage,
} from '../../services/lifecycleWorkflowRuntimeService.js';
import { logLifecycleAudit } from '../../services/lifecycleAuditService.js';

const orgId = (req) => getOrganizationId(req);
const actor = (req) => req.employee || req.user;

/**
 * GET /api/v1/admin/lifecycle/onboarding/:workflowId/stages
 * Get all stages for an onboarding workflow
 */
export const getOnboardingStages = async (req, res) => {
    try {
        const workflow = await loadOnboarding(orgId(req), req.params.workflowId);
        const summary = getStageSummary(workflow);
        const timeline = getStageTimeline(workflow);
        
        return res.json({
            success: true,
            data: {
                stages: workflow.stages || [],
                summary,
                timeline,
                blocked: isWorkflowBlocked(workflow),
                blockingStages: getBlockingStages(workflow),
            },
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/v1/admin/lifecycle/offboarding/:workflowId/stages
 * Get all stages for an offboarding workflow
 */
export const getOffboardingStages = async (req, res) => {
    try {
        const workflow = await loadOffboarding(orgId(req), req.params.workflowId);
        const summary = getStageSummary(workflow);
        const timeline = getStageTimeline(workflow);
        
        return res.json({
            success: true,
            data: {
                stages: workflow.stages || [],
                summary,
                timeline,
                blocked: isWorkflowBlocked(workflow),
                blockingStages: getBlockingStages(workflow),
            },
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, message: error.message });
    }
};

/**
 * PATCH /api/v1/admin/lifecycle/onboarding/:workflowId/stages/:stageId/state
 * Update stage state for onboarding workflow
 */
export const updateOnboardingStageState = async (req, res) => {
    try {
        const workflow = await loadOnboarding(orgId(req), req.params.workflowId);
        const { state, reason } = req.body;

        const updatedWorkflow = await updateStageState(
            workflow,
            req.params.stageId,
            state,
            { reason, actor: actor(req), req }
        );

        await workflow.save();

        // Auto-progress dependent stages
        await autoProgressStages(updatedWorkflow, { actor: actor(req), req });

        const summary = getStageSummary(updatedWorkflow);

        return res.json({
            success: true,
            data: {
                workflow: updatedWorkflow,
                summary,
            },
            message: `Stage state updated to ${state}`,
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, message: error.message });
    }
};

/**
 * PATCH /api/v1/admin/lifecycle/offboarding/:workflowId/stages/:stageId/state
 * Update stage state for offboarding workflow
 */
export const updateOffboardingStageState = async (req, res) => {
    try {
        const workflow = await loadOffboarding(orgId(req), req.params.workflowId);
        const { state, reason } = req.body;

        const updatedWorkflow = await updateStageState(
            workflow,
            req.params.stageId,
            state,
            { reason, actor: actor(req), req }
        );

        await workflow.save();

        // Auto-progress dependent stages
        await autoProgressStages(updatedWorkflow, { actor: actor(req), req });

        const summary = getStageSummary(updatedWorkflow);

        return res.json({
            success: true,
            data: {
                workflow: updatedWorkflow,
                summary,
            },
            message: `Stage state updated to ${state}`,
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/v1/admin/lifecycle/onboarding/:workflowId/stages/auto-progress
 * Auto-progress stages for onboarding workflow
 */
export const autoProgressOnboardingStages = async (req, res) => {
    try {
        const workflow = await loadOnboarding(orgId(req), req.params.workflowId);
        
        const progressed = await autoProgressStages(workflow, { actor: actor(req), req });

        if (progressed) {
            await workflow.save();
        }

        const summary = getStageSummary(workflow);

        return res.json({
            success: true,
            data: {
                workflow,
                summary,
                progressed,
            },
            message: progressed ? 'Stages auto-progressed' : 'No stages to progress',
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/v1/admin/lifecycle/offboarding/:workflowId/stages/auto-progress
 * Auto-progress stages for offboarding workflow
 */
export const autoProgressOffboardingStages = async (req, res) => {
    try {
        const workflow = await loadOffboarding(orgId(req), req.params.workflowId);
        
        const progressed = await autoProgressStages(workflow, { actor: actor(req), req });

        if (progressed) {
            await workflow.save();
        }

        const summary = getStageSummary(workflow);

        return res.json({
            success: true,
            data: {
                workflow,
                summary,
                progressed,
            },
            message: progressed ? 'Stages auto-progressed' : 'No stages to progress',
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/v1/admin/lifecycle/onboarding/:workflowId/stages/next
 * Progress to next stage for onboarding workflow
 */
export const progressOnboardingToNextStage = async (req, res) => {
    try {
        const workflow = await loadOnboarding(orgId(req), req.params.workflowId);
        
        const updatedWorkflow = await progressToNextStage(workflow, { actor: actor(req), req });

        await workflow.save();

        const summary = getStageSummary(updatedWorkflow);

        return res.json({
            success: true,
            data: {
                workflow: updatedWorkflow,
                summary,
            },
            message: 'Progressed to next stage',
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/v1/admin/lifecycle/offboarding/:workflowId/stages/next
 * Progress to next stage for offboarding workflow
 */
export const progressOffboardingToNextStage = async (req, res) => {
    try {
        const workflow = await loadOffboarding(orgId(req), req.params.workflowId);
        
        const updatedWorkflow = await progressToNextStage(workflow, { actor: actor(req), req });

        await workflow.save();

        const summary = getStageSummary(updatedWorkflow);

        return res.json({
            success: true,
            data: {
                workflow: updatedWorkflow,
                summary,
            },
            message: 'Progressed to next stage',
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/v1/admin/lifecycle/onboarding/:workflowId/stages/:stageId/unblock
 * Unblock a stage for onboarding workflow
 */
export const unblockOnboardingStage = async (req, res) => {
    try {
        const workflow = await loadOnboarding(orgId(req), req.params.workflowId);
        const { reason } = req.body;

        const updatedWorkflow = await unblockStage(
            workflow,
            req.params.stageId,
            { reason, actor: actor(req), req }
        );

        await workflow.save();

        const summary = getStageSummary(updatedWorkflow);

        return res.json({
            success: true,
            data: {
                workflow: updatedWorkflow,
                summary,
            },
            message: 'Stage unblocked',
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/v1/admin/lifecycle/offboarding/:workflowId/stages/:stageId/unblock
 * Unblock a stage for offboarding workflow
 */
export const unblockOffboardingStage = async (req, res) => {
    try {
        const workflow = await loadOffboarding(orgId(req), req.params.workflowId);
        const { reason } = req.body;

        const updatedWorkflow = await unblockStage(
            workflow,
            req.params.stageId,
            { reason, actor: actor(req), req }
        );

        await workflow.save();

        const summary = getStageSummary(updatedWorkflow);

        return res.json({
            success: true,
            data: {
                workflow: updatedWorkflow,
                summary,
            },
            message: 'Stage unblocked',
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/v1/admin/lifecycle/onboarding/:workflowId/stages/:stageId/skip
 * Skip a stage for onboarding workflow
 */
export const skipOnboardingStage = async (req, res) => {
    try {
        const workflow = await loadOnboarding(orgId(req), req.params.workflowId);
        const { reason } = req.body;

        const updatedWorkflow = await skipStage(
            workflow,
            req.params.stageId,
            { reason, actor: actor(req), req }
        );

        await workflow.save();

        const summary = getStageSummary(updatedWorkflow);

        return res.json({
            success: true,
            data: {
                workflow: updatedWorkflow,
                summary,
            },
            message: 'Stage skipped',
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/v1/admin/lifecycle/offboarding/:workflowId/stages/:stageId/skip
 * Skip a stage for offboarding workflow
 */
export const skipOffboardingStage = async (req, res) => {
    try {
        const workflow = await loadOffboarding(orgId(req), req.params.workflowId);
        const { reason } = req.body;

        const updatedWorkflow = await skipStage(
            workflow,
            req.params.stageId,
            { reason, actor: actor(req), req }
        );

        await workflow.save();

        const summary = getStageSummary(updatedWorkflow);

        return res.json({
            success: true,
            data: {
                workflow: updatedWorkflow,
                summary,
            },
            message: 'Stage skipped',
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/v1/admin/lifecycle/onboarding/:workflowId/stages/:stageId/progress
 * Get stage progress for onboarding workflow
 */
export const getOnboardingStageProgress = async (req, res) => {
    try {
        const workflow = await loadOnboarding(orgId(req), req.params.workflowId);
        const progress = calculateStageProgress(workflow, req.params.stageId);
        
        return res.json({
            success: true,
            data: { progress },
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/v1/admin/lifecycle/offboarding/:workflowId/stages/:stageId/progress
 * Get stage progress for offboarding workflow
 */
export const getOffboardingStageProgress = async (req, res) => {
    try {
        const workflow = await loadOffboarding(orgId(req), req.params.workflowId);
        const progress = calculateStageProgress(workflow, req.params.stageId);
        
        return res.json({
            success: true,
            data: { progress },
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/v1/admin/lifecycle/onboarding/:workflowId/stages/validate
 * Validate stage configuration for onboarding workflow
 */
export const validateOnboardingStages = async (req, res) => {
    try {
        const workflow = await loadOnboarding(orgId(req), req.params.workflowId);
        const errors = validateStageConfiguration(workflow.stages || []);
        
        return res.json({
            success: true,
            data: {
                valid: errors.length === 0,
                errors,
            },
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/v1/admin/lifecycle/offboarding/:workflowId/stages/validate
 * Validate stage configuration for offboarding workflow
 */
export const validateOffboardingStages = async (req, res) => {
    try {
        const workflow = await loadOffboarding(orgId(req), req.params.workflowId);
        const errors = validateStageConfiguration(workflow.stages || []);
        
        return res.json({
            success: true,
            data: {
                valid: errors.length === 0,
                errors,
            },
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/v1/admin/lifecycle/onboarding/:workflowId/stages/can-progress
 * Check if workflow can progress to next stage
 */
export const canProgressOnboarding = async (req, res) => {
    try {
        const workflow = await loadOnboarding(orgId(req), req.params.workflowId);
        const canProgress = canProgressToNextStage(workflow);
        
        return res.json({
            success: true,
            data: { canProgress },
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/v1/admin/lifecycle/offboarding/:workflowId/stages/can-progress
 * Check if workflow can progress to next stage
 */
export const canProgressOffboarding = async (req, res) => {
    try {
        const workflow = await loadOffboarding(orgId(req), req.params.workflowId);
        const canProgress = canProgressToNextStage(workflow);
        
        return res.json({
            success: true,
            data: { canProgress },
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, message: error.message });
    }
};
