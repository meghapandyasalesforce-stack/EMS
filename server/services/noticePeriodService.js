/**
 * Notice period calculation and management for offboarding.
 */

import { getOrCreateLifecycleSettings, isFeatureEnabled, assertFeatureEnabled } from './lifecycleConfigService.js';
import { addOffboardingActivity } from './offboardingService.js';

const startOfDay = (value) => {
    const d = new Date(value);
    d.setHours(0, 0, 0, 0);
    return d;
};

export function resolveNoticePolicyDays(settings, {
    employmentType, isProbation = false, grade, department,
} = {}) {
    const policy = settings.noticePeriodPolicy || {};
    if (isProbation && policy.probationNoticeDays != null) return policy.probationNoticeDays;

    if (grade && policy.gradePolicies?.length) {
        const gp = policy.gradePolicies.find((p) =>
            String(p.grade).toLowerCase() === String(grade).toLowerCase());
        if (gp?.noticeDays != null) return gp.noticeDays;
    }
    if (department && policy.departmentPolicies?.length) {
        const dp = policy.departmentPolicies.find((p) =>
            String(p.department).toLowerCase() === String(department).toLowerCase());
        if (dp?.noticeDays != null) return dp.noticeDays;
    }
    if (employmentType && policy.employmentTypePolicies?.length) {
        const ep = policy.employmentTypePolicies.find((p) =>
            String(p.type).toLowerCase() === String(employmentType).toLowerCase());
        if (ep?.noticeDays != null) return ep.noticeDays;
    }
    return policy.defaultNoticeDays ?? 30;
}

export function calculateNoticePeriod({
    resignationDate,
    lastWorkingDate,
    policyDays,
    buyoutDays = 0,
    leaveAdjustmentDays = 0,
}) {
    const start = startOfDay(resignationDate || new Date());
    const lwd = startOfDay(lastWorkingDate);
    const totalCalendarDays = Math.max(0, Math.ceil((lwd - start) / 86400000));
    const effectiveServed = Math.max(0, totalCalendarDays - buyoutDays - leaveAdjustmentDays);
    const remaining = Math.max(0, policyDays - effectiveServed);

    let status = 'Active';
    if (buyoutDays > 0) status = 'Buyout';
    if (remaining === 0 && effectiveServed >= policyDays) status = 'Completed';

    return {
        startDate: start,
        policyDays,
        servedDays: effectiveServed,
        remainingDays: remaining,
        buyoutDays,
        leaveAdjustmentDays,
        status,
        lastWorkingDate: lwd,
    };
}

export async function applyNoticePeriodToWorkflow(workflow, organizationId, options = {}) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    if (!isFeatureEnabled(settings, 'noticePeriod')) {
        workflow.noticePeriod = { ...(workflow.noticePeriod?.toObject?.() || workflow.noticePeriod), status: 'Not Applicable' };
        return workflow;
    }

    const policyDays = options.policyDays ?? resolveNoticePolicyDays(settings, options);
    const calc = calculateNoticePeriod({
        resignationDate: workflow.resignationDate || workflow.startDate,
        lastWorkingDate: workflow.lastWorkingDate,
        policyDays,
        buyoutDays: workflow.noticePeriod?.buyoutDays || 0,
        leaveAdjustmentDays: workflow.noticePeriod?.leaveAdjustmentDays || 0,
    });

    workflow.noticePeriod = {
        ...calc,
        buyoutApproved: workflow.noticePeriod?.buyoutApproved || false,
    };
    return workflow;
}

export async function approveNoticeBuyout(workflow, { buyoutDays, actor, notes }) {
    const settings = await assertFeatureEnabled(workflow.organizationId, 'noticePeriod', 'Notice period');
    if (!settings.noticePeriodPolicy?.allowBuyout) {
        throw new Error('Notice buyout is not enabled for this organization');
    }
    const max = settings.noticePeriodPolicy.maxBuyoutDays || 0;
    if (max && buyoutDays > max) throw new Error(`Buyout cannot exceed ${max} days`);

    workflow.noticePeriod = workflow.noticePeriod || {};
    workflow.noticePeriod.buyoutApproved = true;
    workflow.noticePeriod.buyoutDays = buyoutDays;
    await applyNoticePeriodToWorkflow(workflow, workflow.organizationId);

    addOffboardingActivity(workflow, {
        action: 'notice_buyout_approved',
        description: notes || `Notice buyout of ${buyoutDays} day(s) approved`,
        actor,
    });
    return workflow;
}

export function buildNoticePeriodDashboard(workflows) {
    const now = startOfDay(new Date());
    return {
        active: workflows.filter((w) => w.noticePeriod?.status === 'Active').length,
        completed: workflows.filter((w) => w.noticePeriod?.status === 'Completed').length,
        buyout: workflows.filter((w) => w.noticePeriod?.status === 'Buyout').length,
        overdueNotice: workflows.filter((w) =>
            w.noticePeriod?.status === 'Active'
            && w.noticePeriod?.remainingDays > 0
            && w.lastWorkingDate
            && startOfDay(w.lastWorkingDate) < now).length,
        upcomingLwd: workflows.filter((w) => {
            if (!w.lastWorkingDate) return false;
            const days = Math.ceil((startOfDay(w.lastWorkingDate) - now) / 86400000);
            return days >= 0 && days <= 7;
        }).length,
    };
}
