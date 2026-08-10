/**
 * Executes org-configured escalation rules for lifecycle workflows.
 */

import Employee from '../models/employee.model.js';
import { getOrCreateLifecycleSettings, isFeatureEnabled } from './lifecycleConfigService.js';
import { notify } from '../helpers/notificationManager.js';
import { findAuthoritativeHrEscalationRecipient } from '../helpers/lifecycleNotificationRecipients.js';
import logger from '../helpers/logger.js';

const ROLE_PATTERNS = {
    it: /^it$|information technology|system admin/i,
    payroll: /payroll|finance|accounts/i,
    admin: /admin|office admin/i,
    manager: /manager|lead/i,
};

async function findEscalationRecipient(organizationId, role) {
    const escalateRole = role || 'hr';

    // Onboarding/offboarding HR escalations use platform HR roles — not title/dept heuristics.
    if (escalateRole === 'hr') {
        return findAuthoritativeHrEscalationRecipient(organizationId);
    }

    if (escalateRole === 'admin') {
        const adminRecipient = await findAuthoritativeHrEscalationRecipient(organizationId);
        if (adminRecipient) return adminRecipient;
    }

    const pattern = ROLE_PATTERNS[escalateRole];
    if (!pattern) {
        return findAuthoritativeHrEscalationRecipient(organizationId);
    }

    const employee = await Employee.findOne({
        organizationId,
        status: 'active',
        $or: [{ department: pattern }, { jobTitle: pattern }, { position: pattern }],
    }).select('_id name').lean();
    return employee?._id || null;
}

function isOverdueItem(dueDate, now, daysAfterDue) {
    if (!dueDate) return false;
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const threshold = new Date(now);
    threshold.setDate(threshold.getDate() - daysAfterDue);
    threshold.setHours(0, 0, 0, 0);
    return due <= threshold;
}

export async function processLifecycleEscalations({
    organizationId,
    workflow,
    module,
    overdueItems = [],
    now = new Date(),
}) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    if (!isFeatureEnabled(settings, 'escalations')) return { escalationsSent: 0 };

    const rules = (settings.escalations || []).filter((r) => r.enabled !== false);
    if (!rules.length || !overdueItems.length) return { escalationsSent: 0 };

    let escalationsSent = 0;
    if (!workflow.escalationHistory) workflow.escalationHistory = [];

    for (const item of overdueItems) {
        for (const rule of rules) {
            if (rule.featureKey && !isFeatureEnabled(settings, rule.featureKey)) continue;
            const daysAfter = rule.daysAfterDue ?? 2;
            if (!isOverdueItem(item.dueDate, now, daysAfter)) continue;

            const key = `escalation:${rule.key}:${item.id}:${daysAfter}`;
            if (workflow.escalationHistory.some((e) => e.key === key)) continue;

            const recipient = await findEscalationRecipient(organizationId, rule.escalateToRole || 'hr');
            if (!recipient) continue;

            workflow.escalationHistory.push({ key, ruleKey: rule.key, sentAt: now, recipient });

            const channels = rule.channels || ['email', 'in_app'];
            await notify({
                type: module === 'offboarding' ? 'lifecycle_offboarding_escalation' : 'lifecycle_onboarding_escalation',
                organizationId,
                data: {
                    workflow,
                    item,
                    rule,
                    recipient,
                    channels,
                    title: rule.label || 'Lifecycle Escalation',
                    message: `Overdue: ${item.label} — escalation after ${daysAfter} day(s).`,
                },
            }).catch((e) => logger.warn('Escalation notify failed', { error: e.message }));

            escalationsSent += 1;
        }
    }
    return { escalationsSent };
}

export function collectOverdueOnboardingItems(workflow, now = new Date()) {
    const items = [];
    const push = (kind, entity, label) => {
        if (!entity.dueDate || ['Completed', 'Cancelled', 'Verified', 'Signed'].includes(entity.status)) return;
        if (entity.status !== 'Overdue' && new Date(entity.dueDate) >= now) return;
        items.push({
            id: entity._id?.toString() || `${kind}-${label}`,
            kind,
            label,
            dueDate: entity.dueDate,
            assigneeRole: entity.assigneeRole,
        });
    };
    for (const task of workflow.tasks || []) {
        if (task.status === 'Overdue' || (task.dueDate && new Date(task.dueDate) < now && task.status !== 'Completed')) {
            push('task', task, task.title);
        }
    }
    return items;
}

export function collectOverdueOffboardingItems(workflow, now = new Date()) {
    const items = [];
    for (const task of workflow.tasks || []) {
        if (task.status === 'Overdue' || (task.dueDate && new Date(task.dueDate) < now && task.status !== 'Completed')) {
            items.push({
                id: task._id?.toString(),
                kind: 'task',
                label: task.title,
                dueDate: task.dueDate,
            });
        }
    }
    for (const item of workflow.clearanceChecklist || []) {
        if (!item.completed && item.dueDate && new Date(item.dueDate) < now) {
            items.push({
                id: item._id?.toString(),
                kind: 'clearance',
                label: item.item,
                dueDate: item.dueDate,
            });
        }
    }
    return items;
}
