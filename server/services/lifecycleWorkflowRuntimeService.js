/**
 * Workflow Runtime Service - Stage execution, dependencies, approvals, conditional visibility, auto progression
 * Extends onboarding/offboarding workflows with full runtime capabilities
 */

import { OnboardingWorkflow, OffboardingWorkflow } from '../models/onboarding.model.js';
import { getOrCreateLifecycleSettings, isFeatureEnabled } from './lifecycleConfigService.js';
import { notify } from '../helpers/notificationManager.js';
import { logLifecycleAudit } from './lifecycleAuditService.js';
import logger from '../helpers/logger.js';

// Stage states
export const STAGE_STATES = Object.freeze([
    'Not Started',
    'In Progress',
    'Completed',
    'Skipped',
    'Blocked',
    'Overdue',
]);

// Stage transition rules
export const STAGE_TRANSITIONS = Object.freeze({
    'Not Started': ['In Progress', 'Skipped', 'Blocked'],
    'In Progress': ['Completed', 'Blocked', 'Overdue'],
    'Blocked': ['In Progress', 'Skipped'],
    'Overdue': ['In Progress', 'Completed', 'Skipped'],
    'Completed': [],
    'Skipped': [],
});

/**
 * Check if a stage can transition to a new state
 */
export function canTransitionStage(currentState, newState) {
    const allowedTransitions = STAGE_TRANSITIONS[currentState] || [];
    return allowedTransitions.includes(newState);
}

/**
 * Check if stage dependencies are satisfied
 */
export function areStageDependenciesSatisfied(workflow, stage, allStages) {
    if (!stage.dependencies || !stage.dependencies.length) return true;

    const dependencyStages = allStages.filter(s => 
        stage.dependencies.includes(s._id?.toString() || s.id)
    );

    return dependencyStages.every(dep => 
        dep.status === 'Completed' || dep.status === 'Skipped'
    );
}

/**
 * Check if stage conditions are met (conditional visibility)
 */
export function areStageConditionsMet(workflow, stage, settings) {
    if (!stage.conditions) return true;

    // Feature-based conditions
    if (stage.conditions.featureKey) {
        if (!isFeatureEnabled(settings, stage.conditions.featureKey)) {
            return false;
        }
    }

    // Data-based conditions
    if (stage.conditions.requires) {
        for (const [field, value] of Object.entries(stage.conditions.requires)) {
            const workflowValue = getNestedValue(workflow, field);
            if (workflowValue !== value) return false;
        }
    }

    // Progress-based conditions
    if (stage.conditions.minProgress !== undefined) {
        if (workflow.progress < stage.conditions.minProgress) return false;
    }

    // Date-based conditions
    if (stage.conditions.afterDate) {
        if (new Date() < new Date(stage.conditions.afterDate)) return false;
    }

    return true;
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Update stage state with validation
 */
export async function updateStageState(workflow, stageId, newState, { reason, actor, req } = {}) {
    const stages = workflow.stages || [];
    const stageIndex = stages.findIndex(s => 
        (s._id?.toString() || s.id) === stageId
    );

    if (stageIndex === -1) {
        throw new Error('Stage not found');
    }

    const stage = stages[stageIndex];
    const currentState = stage.status;

    if (!canTransitionStage(currentState, newState)) {
        throw new Error(`Cannot transition stage from ${currentState} to ${newState}`);
    }

    // Check dependencies if moving to In Progress
    if (newState === 'In Progress') {
        const settings = await getOrCreateLifecycleSettings(workflow.organizationId);
        if (!areStageDependenciesSatisfied(workflow, stage, stages)) {
            throw new Error('_stage dependencies are not satisfied');
        }
        if (!areStageConditionsMet(workflow, stage, settings)) {
            throw new Error('Stage conditions are not met');
        }
    }

    // Update stage
    workflow.stages[stageIndex].status = newState;
    workflow.stages[stageIndex].updatedAt = new Date();
    workflow.stages[stageIndex].updatedBy = actor?._id;

    if (reason) {
        workflow.stages[stageIndex].reason = reason;
    }

    // Set timestamps based on state
    if (newState === 'In Progress' && !workflow.stages[stageIndex].startedAt) {
        workflow.stages[stageIndex].startedAt = new Date();
    }
    if (newState === 'Completed' && !workflow.stages[stageIndex].completedAt) {
        workflow.stages[stageIndex].completedAt = new Date();
    }
    if (newState === 'Overdue' && !workflow.stages[stageIndex].overdueAt) {
        workflow.stages[stageIndex].overdueAt = new Date();
    }

    // Add to activity feed
    workflow.activityFeed = workflow.activityFeed || [];
    workflow.activityFeed.unshift({
        action: 'stage_state_changed',
        description: `Stage "${stage.name}" transitioned from ${currentState} to ${newState}`,
        actor: actor?._id,
        actorName: actor?.name,
        metadata: { stageId: stage._id || stage.id, stageName: stage.name, from: currentState, to: newState, reason },
        createdAt: new Date(),
    });

    // Log audit
    await logLifecycleAudit({
        action: 'Update',
        entityType: workflow.constructor.modelName,
        entityId: workflow._id,
        entityName: `Stage: ${stage.name}`,
        actor,
        req,
        metadata: { stageId, from: currentState, to: newState, reason },
    });

    // Notify relevant parties
    await notify({
        type: 'lifecycle_stage_updated',
        organizationId: workflow.organizationId,
        data: {
            workflowId: workflow._id,
            stageId: stage._id || stage.id,
            stageName: stage.name,
            newState,
            employeeId: workflow.employeeId,
        },
    }).catch(() => {});

    return workflow;
}

/**
 * Auto-progress stages when dependencies are satisfied
 */
export async function autoProgressStages(workflow, { actor, req } = {}) {
    const settings = await getOrCreateLifecycleSettings(workflow.organizationId);
    const stages = workflow.stages || [];
    let progressed = false;

    for (const stage of stages) {
        // Skip already completed or in-progress stages
        if (['Completed', 'In Progress', 'Skipped'].includes(stage.status)) {
            continue;
        }

        // Check if stage should auto-start
        if (stage.autoStart !== false && areStageDependenciesSatisfied(workflow, stage, stages)) {
            if (areStageConditionsMet(workflow, stage, settings)) {
                try {
                    await updateStageState(workflow, stage._id?.toString() || stage.id, 'In Progress', {
                        reason: 'Auto-progressed: Dependencies satisfied',
                        actor,
                        req,
                    });
                    progressed = true;
                } catch (error) {
                    logger.warn('Failed to auto-progress stage', {
                        workflowId: workflow._id,
                        stageId: stage._id,
                        error: error.message,
                    });
                }
            }
        }
    }

    // Check for overdue stages
    await syncStageOverdueStatus(workflow);

    return progressed;
}

/**
 * Sync overdue status for stages based on due dates
 */
export function syncStageOverdueStatus(workflow) {
    const now = new Date();
    let changed = false;

    for (const stage of workflow.stages || []) {
        if (stage.status === 'In Progress' && stage.dueDate) {
            if (new Date(stage.dueDate) < now && stage.status !== 'Overdue') {
                stage.status = 'Overdue';
                stage.overdueAt = now;
                changed = true;
            }
        }
    }

    return changed;
}

/**
 * Check if workflow can move to next stage
 */
export function canProgressToNextStage(workflow) {
    const stages = workflow.stages || [];
    const currentStageIndex = stages.findIndex(s => s.status === 'In Progress');

    if (currentStageIndex === -1) return false;

    const currentStage = stages[currentStageIndex];
    
    // Check if current stage is complete
    if (currentStage.status !== 'Completed') return false;

    // Check if there's a next stage
    if (currentStageIndex >= stages.length - 1) return false;

    const nextStage = stages[currentStageIndex + 1];
    
    // Check if next stage's dependencies are met
    return areStageDependenciesSatisfied(workflow, nextStage, stages);
}

/**
 * Progress workflow to next stage
 */
export async function progressToNextStage(workflow, { actor, req } = {}) {
    if (!canProgressToNextStage(workflow)) {
        throw new Error('Cannot progress to next stage - current stage not complete or dependencies not met');
    }

    const stages = workflow.stages || [];
    const currentStageIndex = stages.findIndex(s => s.status === 'In Progress');
    const nextStage = stages[currentStageIndex + 1];

    await updateStageState(workflow, nextStage._id?.toString() || nextStage.id, 'In Progress', {
        reason: 'Manual progression to next stage',
        actor,
        req,
    });

    return workflow;
}

/**
 * Get workflow stage summary
 */
export function getStageSummary(workflow) {
    const stages = workflow.stages || [];
    
    return {
        total: stages.length,
        notStarted: stages.filter(s => s.status === 'Not Started').length,
        inProgress: stages.filter(s => s.status === 'In Progress').length,
        completed: stages.filter(s => s.status === 'Completed').length,
        skipped: stages.filter(s => s.status === 'Skipped').length,
        blocked: stages.filter(s => s.status === 'Blocked').length,
        overdue: stages.filter(s => s.status === 'Overdue').length,
        currentStage: stages.find(s => s.status === 'In Progress') || null,
        nextStage: stages.find(s => s.status === 'Not Started') || null,
    };
}

/**
 * Initialize default stages for onboarding workflow
 */
export function initializeOnboardingStages(workflow, template) {
    const templateStages = template?.stages || [];
    
    if (templateStages.length === 0) {
        // Default stages if template has none
        workflow.stages = [
            {
                id: 'pre_joining',
                name: 'Pre-Joining',
                description: 'Complete all pre-joining formalities',
                status: 'Not Started',
                order: 1,
                autoStart: true,
                dependencies: [],
            },
            {
                id: 'day_1',
                name: 'Day 1 Onboarding',
                description: 'First day orientation and setup',
                status: 'Not Started',
                order: 2,
                autoStart: true,
                dependencies: ['pre_joining'],
            },
            {
                id: 'first_week',
                name: 'First Week',
                description: 'Complete first week activities',
                status: 'Not Started',
                order: 3,
                autoStart: true,
                dependencies: ['day_1'],
            },
            {
                id: 'first_month',
                name: 'First Month',
                description: 'Complete first month milestones',
                status: 'Not Started',
                order: 4,
                autoStart: true,
                dependencies: ['first_week'],
            },
        ];
    } else {
        // Use template stages
        workflow.stages = templateStages.map((stage, index) => ({
            ...stage,
            status: index === 0 ? 'Not Started' : 'Not Started',
            order: index + 1,
        }));
    }

    // Start the first stage if autoStart is enabled
    if (workflow.stages.length > 0 && workflow.stages[0].autoStart !== false) {
        workflow.stages[0].status = 'In Progress';
        workflow.stages[0].startedAt = new Date();
    }

    return workflow;
}

/**
 * Initialize default stages for offboarding workflow
 */
export function initializeOffboardingStages(workflow, template) {
    const templateStages = template?.stages || [];
    
    if (templateStages.length === 0) {
        // Default stages if template has none
        workflow.stages = [
            {
                id: 'initiation',
                name: 'Resignation Initiation',
                description: 'Process resignation and notice period',
                status: 'Not Started',
                order: 1,
                autoStart: true,
                dependencies: [],
            },
            {
                id: 'handover',
                name: 'Knowledge Handover',
                description: 'Complete knowledge transfer',
                status: 'Not Started',
                order: 2,
                autoStart: true,
                dependencies: ['initiation'],
            },
            {
                id: 'clearance',
                name: 'Clearances',
                description: 'Complete all departmental clearances',
                status: 'Not Started',
                order: 3,
                autoStart: true,
                dependencies: ['handover'],
            },
            {
                id: 'final_settlement',
                name: 'Final Settlement',
                description: 'Complete F&F and exit formalities',
                status: 'Not Started',
                order: 4,
                autoStart: true,
                dependencies: ['clearance'],
            },
        ];
    } else {
        // Use template stages
        workflow.stages = templateStages.map((stage, index) => ({
            ...stage,
            status: index === 0 ? 'Not Started' : 'Not Started',
            order: index + 1,
        }));
    }

    // Start the first stage if autoStart is enabled
    if (workflow.stages.length > 0 && workflow.stages[0].autoStart !== false) {
        workflow.stages[0].status = 'In Progress';
        workflow.stages[0].startedAt = new Date();
    }

    return workflow;
}

/**
 * Check if workflow is blocked by any stage
 */
export function isWorkflowBlocked(workflow) {
    const stages = workflow.stages || [];
    return stages.some(s => s.status === 'Blocked');
}

/**
 * Get blocking stages
 */
export function getBlockingStages(workflow) {
    const stages = workflow.stages || [];
    return stages.filter(s => s.status === 'Blocked');
}

/**
 * Unblock a stage
 */
export async function unblockStage(workflow, stageId, { reason, actor, req } = {}) {
    const stages = workflow.stages || [];
    const stageIndex = stages.findIndex(s => 
        (s._id?.toString() || s.id) === stageId
    );

    if (stageIndex === -1) {
        throw new Error('Stage not found');
    }

    const stage = stages[stageIndex];
    if (stage.status !== 'Blocked') {
        throw new Error('Stage is not blocked');
    }

    await updateStageState(workflow, stageId, 'In Progress', {
        reason: `Unblocked: ${reason || 'Manual unblock'}`,
        actor,
        req,
    });

    return workflow;
}

/**
 * Skip a stage (if allowed)
 */
export async function skipStage(workflow, stageId, { reason, actor, req } = {}) {
    const stages = workflow.stages || [];
    const stageIndex = stages.findIndex(s => 
        (s._id?.toString() || s.id) === stageId
    );

    if (stageIndex === -1) {
        throw new Error('Stage not found');
    }

    const stage = stages[stageIndex];
    if (stage.allowSkip !== true) {
        throw new Error('This stage cannot be skipped');
    }

    await updateStageState(workflow, stageId, 'Skipped', {
        reason: `Skipped: ${reason || 'Manual skip'}`,
        actor,
        req,
    });

    // Auto-progress dependent stages
    await autoProgressStages(workflow, { actor, req });

    return workflow;
}

/**
 * Calculate stage progress based on tasks and checklist items
 */
export function calculateStageProgress(workflow, stageId) {
    const stage = (workflow.stages || []).find(s => 
        (s._id?.toString() || s.id) === stageId
    );

    if (!stage) return 0;

    // If stage has explicit progress, use it
    if (stage.progress !== undefined) return stage.progress;

    // Calculate based on associated tasks
    const stageTasks = (workflow.tasks || []).filter(t => 
        t.stageId === stageId || t.stage === stage.id
    );

    if (stageTasks.length === 0) return stage.status === 'Completed' ? 100 : 0;

    const completedTasks = stageTasks.filter(t => t.status === 'Completed').length;
    return Math.round((completedTasks / stageTasks.length) * 100);
}

/**
 * Get stage timeline with key events
 */
export function getStageTimeline(workflow) {
    const stages = workflow.stages || [];
    const timeline = [];

    for (const stage of stages) {
        if (stage.startedAt) {
            timeline.push({
                type: 'stage_started',
                stageId: stage._id || stage.id,
                stageName: stage.name,
                timestamp: stage.startedAt,
            });
        }
        if (stage.completedAt) {
            timeline.push({
                type: 'stage_completed',
                stageId: stage._id || stage.id,
                stageName: stage.name,
                timestamp: stage.completedAt,
            });
        }
        if (stage.overdueAt) {
            timeline.push({
                type: 'stage_overdue',
                stageId: stage._id || stage.id,
                stageName: stage.name,
                timestamp: stage.overdueAt,
            });
        }
    }

    // Sort by timestamp
    return timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

/**
 * Validate workflow stage configuration
 */
export function validateStageConfiguration(stages) {
    const errors = [];
    const stageIds = new Set();

    for (const stage of stages) {
        const stageId = stage._id?.toString() || stage.id;

        // Check for duplicate IDs
        if (stageIds.has(stageId)) {
            errors.push(`Duplicate stage ID: ${stageId}`);
        }
        stageIds.add(stageId);

        // Check dependencies exist
        if (stage.dependencies) {
            for (const depId of stage.dependencies) {
                if (!stageIds.has(depId) && depId !== stageId) {
                    // Dependency might be defined later, so we'll check after loop
                }
            }
        }

        // Check valid state
        if (!STAGE_STATES.includes(stage.status)) {
            errors.push(`Invalid state for stage ${stageId}: ${stage.status}`);
        }

        // Check circular dependencies
        if (hasCircularDependency(stage, stages)) {
            errors.push(`Circular dependency detected for stage ${stageId}`);
        }
    }

    // Second pass for dependency validation
    for (const stage of stages) {
        const stageId = stage._id?.toString() || stage.id;
        if (stage.dependencies) {
            for (const depId of stage.dependencies) {
                if (!stageIds.has(depId)) {
                    errors.push(`Stage ${stageId} depends on non-existent stage ${depId}`);
                }
            }
        }
    }

    return errors;
}

/**
 * Check for circular dependencies in stages
 */
function hasCircularDependency(stage, allStages, visited = new Set()) {
    const stageId = stage._id?.toString() || stage.id;
    
    if (visited.has(stageId)) return true;
    visited.add(stageId);

    if (!stage.dependencies) return false;

    for (const depId of stage.dependencies) {
        const depStage = allStages.find(s => 
            (s._id?.toString() || s.id) === depId
        );
        if (depStage && hasCircularDependency(depStage, allStages, new Set(visited))) {
            return true;
        }
    }

    return false;
}
