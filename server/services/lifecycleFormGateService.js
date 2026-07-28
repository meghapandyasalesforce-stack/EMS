/**
 * Mandatory lifecycle form gates — progress + workflow completion blocking.
 * Configure feature flags are the single source of truth.
 */

import { LifecycleFormDefinition, LifecycleFormResponse } from '../models/lifecycle.model.js';
import { getOrCreateLifecycleSettings, isFeatureEnabled } from './lifecycleConfigService.js';
import { DEFAULT_FORMS } from './lifecycleDefaultFormsService.js';

const MANDATORY_FORM_NAMES = new Set(
    DEFAULT_FORMS.filter((f) => f.mandatory).map((f) => f.name),
);

function formFeatureEnabled(settings, form) {
    const key = form?.featureKey;
    if (!key) {
        return isFeatureEnabled(settings, 'digitalForms')
            || isFeatureEnabled(settings, 'emergencyContact')
            || isFeatureEnabled(settings, 'familyNominee')
            || isFeatureEnabled(settings, 'bankDetails');
    }
    if (isFeatureEnabled(settings, key)) return true;
    // Custom / pack feature keys from Form Builder — still show when digital forms is on
    return isFeatureEnabled(settings, 'digitalForms');
}

function isMandatoryOnboardingForm(form) {
    if (form.tags?.includes('optional') || form.tags?.includes('not_mandatory')) return false;
    if (form.tags?.includes('mandatory')) return true;
    if (MANDATORY_FORM_NAMES.has(form.name)) return true;
    // Published onboarding forms created in Form Builder appear here by default
    return ['onboarding', 'both'].includes(form.category || form.module);
}

export async function getMandatoryFormsForOrg(organizationId) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    if (!isFeatureEnabled(settings, 'digitalForms')
        && !isFeatureEnabled(settings, 'emergencyContact')
        && !isFeatureEnabled(settings, 'familyNominee')
        && !isFeatureEnabled(settings, 'bankDetails')) {
        return [];
    }

    const forms = await LifecycleFormDefinition.find({
        organizationId,
        status: 'Published',
        isActive: true,
        category: { $in: ['onboarding', 'compliance', 'employee_profile', 'both'] },
    }).lean();

    return forms
        .filter((f) => isMandatoryOnboardingForm(f))
        .filter((f) => formFeatureEnabled(settings, f));
}

export async function getFormCompletionStatus(organizationId, { employeeId, workflowId }) {
    const mandatoryForms = await getMandatoryFormsForOrg(organizationId);
    if (!mandatoryForms.length) {
        return { total: 0, completed: 0, progress: 100, items: [], allComplete: true };
    }

    const responseQuery = {
        organizationId,
        employeeId,
        formDefinitionId: { $in: mandatoryForms.map((f) => f._id) },
    };
    if (workflowId) {
        responseQuery.$or = [
            { workflowId },
            { workflowId: null },
            { workflowId: { $exists: false } },
        ];
    }

    const responses = await LifecycleFormResponse.find(responseQuery).lean();

    const responseByForm = new Map(responses.map((r) => [String(r.formDefinitionId), r]));
    const items = mandatoryForms.map((form) => {
        const resp = responseByForm.get(String(form._id));
        const done = resp && ['Submitted', 'Approved'].includes(resp.status);
        return {
            formId: form._id,
            name: form.name,
            featureKey: form.featureKey,
            status: resp?.status || 'Not Started',
            responseId: resp?._id,
            completed: done,
        };
    });

    const completed = items.filter((i) => i.completed).length;
    const total = items.length;
    const progress = total ? Math.round((completed / total) * 100) : 100;

    return {
        total,
        completed,
        progress,
        items,
        allComplete: completed === total,
    };
}

export async function syncFormGateToWorkflow(workflow, organizationId) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    if (!isFeatureEnabled(settings, 'digitalForms')
        && !isFeatureEnabled(settings, 'emergencyContact')
        && !isFeatureEnabled(settings, 'familyNominee')
        && !isFeatureEnabled(settings, 'bankDetails')) {
        workflow.mandatoryFormsCompleted = true;
        workflow.formsProgress = 100;
        workflow.formGateStatus = [];
        return workflow;
    }

    const status = await getFormCompletionStatus(organizationId, {
        employeeId: workflow.employeeId,
        workflowId: workflow._id,
    });

    workflow.mandatoryFormsCompleted = status.allComplete;
    workflow.formsProgress = status.progress;
    workflow.formGateStatus = status.items;
    return workflow;
}

export default {
    getMandatoryFormsForOrg,
    getFormCompletionStatus,
    syncFormGateToWorkflow,
};
