/**
 * HR Experience Service - Full visibility, bulk actions, reports, approvals
 * Provides HR-specific lifecycle operations with comprehensive access
 */

import { OnboardingWorkflow, OffboardingWorkflow } from '../models/onboarding.model.js';
import { LifecycleFormResponse } from '../models/lifecycle.model.js';
import { BackgroundVerificationCase } from '../models/lifecycleGap.model.js';
import { getOrCreateLifecycleSettings, isFeatureEnabled } from './lifecycleConfigService.js';
import { logLifecycleAudit } from './lifecycleAuditService.js';
import { notify } from '../helpers/notificationManager.js';
import { getFormCompletionStatus } from './lifecycleFormGateService.js';

/**
 * Get HR dashboard with comprehensive statistics
 */
export async function getHRDashboard(organizationId) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    
    const onboardingEnabled = isFeatureEnabled(settings, 'onboarding');
    const offboardingEnabled = isFeatureEnabled(settings, 'offboarding');
    const bgvEnabled = isFeatureEnabled(settings, 'backgroundVerification');
    const formsEnabled = isFeatureEnabled(settings, 'digitalForms') || 
                       isFeatureEnabled(settings, 'emergencyContact') ||
                       isFeatureEnabled(settings, 'familyNominee') ||
                       isFeatureEnabled(settings, 'bankDetails');

    let onboardingStats = { total: 0, inProgress: 0, completed: 0, overdue: 0, avgProgress: 0 };
    let offboardingStats = { total: 0, inProgress: 0, completed: 0 };
    let bgvStats = { total: 0, inProgress: 0, clear: 0, failed: 0 };
    let formsStats = { total: 0, pending: 0, completed: 0 };
    let pendingApprovals = 0;

    if (onboardingEnabled) {
        const onboardingWorkflows = await OnboardingWorkflow.find({
            organizationId,
            isTemplate: { $ne: true },
        }).lean();

        onboardingStats.total = onboardingWorkflows.length;
        onboardingStats.inProgress = onboardingWorkflows.filter(w => ['In Progress', 'Not Started'].includes(w.status)).length;
        onboardingStats.completed = onboardingWorkflows.filter(w => w.status === 'Completed').length;
        onboardingStats.overdue = onboardingWorkflows.filter(w => w.status === 'Overdue').length;
        
        const totalProgress = onboardingWorkflows.reduce((sum, w) => sum + (w.progress || 0), 0);
        onboardingStats.avgProgress = onboardingWorkflows.length ? Math.round(totalProgress / onboardingWorkflows.length) : 0;
    }

    if (offboardingEnabled) {
        const offboardingWorkflows = await OffboardingWorkflow.find({
            organizationId,
            isTemplate: { $ne: true },
        }).lean();

        offboardingStats.total = offboardingWorkflows.length;
        offboardingStats.inProgress = offboardingWorkflows.filter(w => ['Initiated', 'In Progress'].includes(w.status)).length;
        offboardingStats.completed = offboardingWorkflows.filter(w => w.status === 'Completed').length;
    }

    if (bgvEnabled) {
        const bgvCases = await BackgroundVerificationCase.find({
            organizationId,
        }).lean();

        bgvStats.total = bgvCases.length;
        bgvStats.inProgress = bgvCases.filter(c => c.overallStatus === 'In Progress').length;
        bgvStats.clear = bgvCases.filter(c => c.overallStatus === 'Clear').length;
        bgvStats.failed = bgvCases.filter(c => c.overallStatus === 'Failed').length;
    }

    if (formsEnabled) {
        const formResponses = await LifecycleFormResponse.find({
            organizationId,
        }).lean();

        formsStats.total = formResponses.length;
        formsStats.pending = formResponses.filter(r => r.status === 'Draft' || r.status === 'Pending Approval').length;
        formsStats.completed = formResponses.filter(r => ['Submitted', 'Approved'].includes(r.status)).length;
    }

    // Count pending approvals (from approval engine)
    const { getPendingApprovals } = await import('./lifecycleApprovalService.js');
    try {
        const approvals = await getPendingApprovals(organizationId);
        pendingApprovals = approvals.length;
    } catch (error) {
        pendingApprovals = 0;
    }

    return {
        onboarding: onboardingEnabled ? onboardingStats : null,
        offboarding: offboardingEnabled ? offboardingStats : null,
        bgv: bgvEnabled ? bgvStats : null,
        forms: formsEnabled ? formsStats : null,
        pendingApprovals,
        featuresEnabled: {
            onboarding: onboardingEnabled,
            offboarding: offboardingEnabled,
            bgv: bgvEnabled,
            forms: formsEnabled,
        },
    };
}

/**
 * Bulk update workflow statuses
 */
export async function bulkUpdateWorkflowStatus(organizationId, workflowIds, { status, actor, req } = {}) {
    const results = [];
    
    for (const workflowId of workflowIds) {
        try {
            // Try onboarding first
            let workflow = await OnboardingWorkflow.findOne({
                _id: workflowId,
                organizationId,
            });

            if (!workflow) {
                // Try offboarding
                workflow = await OffboardingWorkflow.findOne({
                    _id: workflowId,
                    organizationId,
                });
            }

            if (!workflow) {
                results.push({ id: workflowId, success: false, message: 'Workflow not found' });
                continue;
            }

            const previousStatus = workflow.status;
            workflow.status = status;
            workflow.activityFeed = workflow.activityFeed || [];
            workflow.activityFeed.unshift({
                action: 'status_changed',
                description: `Status changed from ${previousStatus} to ${status}`,
                actor: actor?._id,
                actorName: actor?.name,
                metadata: { previousStatus, newStatus: status },
            });

            await workflow.save();

            await logLifecycleAudit({
                action: 'Update',
                entityType: workflow.constructor.modelName,
                entityId: workflow._id,
                entityName: 'Bulk Status Update',
                req,
                actor,
                metadata: { previousStatus, newStatus: status },
            });

            results.push({ id: workflowId, success: true, workflow });
        } catch (error) {
            results.push({ id: workflowId, success: false, message: error.message });
        }
    }

    await logLifecycleAudit({
        action: 'Bulk Operation',
        entityType: 'Workflow',
        entityId: null,
        entityName: 'Bulk Status Update',
        req,
        actor,
        metadata: { workflowIds, status, successCount: results.filter(r => r.success).length },
    });

    return results;
}

/**
 * Bulk assign manager to workflows
 */
export async function bulkAssignManager(organizationId, workflowIds, managerId, { actor, req } = {}) {
    const results = [];
    
    for (const workflowId of workflowIds) {
        try {
            let workflow = await OnboardingWorkflow.findOne({
                _id: workflowId,
                organizationId,
            });

            if (!workflow) {
                workflow = await OffboardingWorkflow.findOne({
                    _id: workflowId,
                    organizationId,
                });
            }

            if (!workflow) {
                results.push({ id: workflowId, success: false, message: 'Workflow not found' });
                continue;
            }

            workflow.assignedManager = managerId;
            workflow.activityFeed = workflow.activityFeed || [];
            workflow.activityFeed.unshift({
                action: 'manager_assigned',
                description: 'Manager assigned via bulk operation',
                actor: actor?._id,
                actorName: actor?.name,
                metadata: { managerId },
            });

            await workflow.save();

            results.push({ id: workflowId, success: true, workflow });
        } catch (error) {
            results.push({ id: workflowId, success: false, message: error.message });
        }
    }

    await logLifecycleAudit({
        action: 'Bulk Operation',
        entityType: 'Workflow',
        entityId: null,
        entityName: 'Bulk Manager Assignment',
        req,
        actor,
        metadata: { workflowIds, managerId, successCount: results.filter(r => r.success).length },
    });

    return results;
}

/**
 * Bulk assign buddy to workflows
 */
export async function bulkAssignBuddy(organizationId, workflowIds, buddyId, { actor, req } = {}) {
    const results = [];
    
    for (const workflowId of workflowIds) {
        try {
            const workflow = await OnboardingWorkflow.findOne({
                _id: workflowId,
                organizationId,
            });

            if (!workflow) {
                results.push({ id: workflowId, success: false, message: 'Onboarding workflow not found' });
                continue;
            }

            workflow.assignedBuddy = buddyId;
            workflow.activityFeed = workflow.activityFeed || [];
            workflow.activityFeed.unshift({
                action: 'buddy_assigned',
                description: 'Buddy assigned via bulk operation',
                actor: actor?._id,
                actorName: actor?.name,
                metadata: { buddyId },
            });

            await workflow.save();

            await notify({
                type: 'lifecycle_buddy_assigned',
                organizationId,
                data: { workflowId, buddyId, employeeId: workflow.employeeId },
            }).catch(() => {});

            results.push({ id: workflowId, success: true, workflow });
        } catch (error) {
            results.push({ id: workflowId, success: false, message: error.message });
        }
    }

    await logLifecycleAudit({
        action: 'Bulk Operation',
        entityType: 'OnboardingWorkflow',
        entityId: null,
        entityName: 'Bulk Buddy Assignment',
        req,
        actor,
        metadata: { workflowIds, buddyId, successCount: results.filter(r => r.success).length },
    });

    return results;
}

/**
 * Get pending approvals for HR
 */
export async function getHRPendingApprovals(organizationId) {
    const { getPendingApprovals } = await import('./lifecycleApprovalService.js');
    
    try {
        const approvals = await getPendingApprovals(organizationId);
        return approvals;
    } catch (error) {
        return [];
    }
}

/**
 * Get HR reports with filters
 */
export async function getHRReports(organizationId, filters = {}) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    
    const reports = {};

    if (isFeatureEnabled(settings, 'onboarding') && (!filters.module || filters.module === 'onboarding')) {
        const onboardingWorkflows = await OnboardingWorkflow.find({
            organizationId,
            isTemplate: { $ne: true },
            ...(filters.status ? { status: filters.status } : {}),
            ...(filters.department ? { 'employee.department': filters.department } : {}),
        })
        .populate('employeeId', 'firstName lastName department')
        .sort({ createdAt: -1 })
        .lean();

        reports.onboarding = {
            total: onboardingWorkflows.length,
            byStatus: onboardingWorkflows.reduce((acc, w) => {
                acc[w.status] = (acc[w.status] || 0) + 1;
                return acc;
            }, {}),
            byDepartment: onboardingWorkflows.reduce((acc, w) => {
                const dept = w.employeeId?.department || 'Unassigned';
                acc[dept] = (acc[dept] || 0) + 1;
                return acc;
            }, {}),
            avgProgress: onboardingWorkflows.length 
                ? Math.round(onboardingWorkflows.reduce((sum, w) => sum + (w.progress || 0), 0) / onboardingWorkflows.length)
                : 0,
            workflows: onboardingWorkflows,
        };
    }

    if (isFeatureEnabled(settings, 'offboarding') && (!filters.module || filters.module === 'offboarding')) {
        const offboardingWorkflows = await OffboardingWorkflow.find({
            organizationId,
            isTemplate: { $ne: true },
            ...(filters.status ? { status: filters.status } : {}),
        })
        .populate('employeeId', 'firstName lastName department')
        .sort({ createdAt: -1 })
        .lean();

        reports.offboarding = {
            total: offboardingWorkflows.length,
            byStatus: offboardingWorkflows.reduce((acc, w) => {
                acc[w.status] = (acc[w.status] || 0) + 1;
                return acc;
            }, {}),
            workflows: offboardingWorkflows,
        };
    }

    if (isFeatureEnabled(settings, 'backgroundVerification') && (!filters.module || filters.module === 'bgv')) {
        const bgvCases = await BackgroundVerificationCase.find({
            organizationId,
            ...(filters.status ? { overallStatus: filters.status } : {}),
        })
        .populate('employeeId', 'firstName lastName')
        .sort({ createdAt: -1 })
        .lean();

        reports.bgv = {
            total: bgvCases.length,
            byStatus: bgvCases.reduce((acc, c) => {
                acc[c.overallStatus] = (acc[c.overallStatus] || 0) + 1;
                return acc;
            }, {}),
            byVendor: bgvCases.reduce((acc, c) => {
                acc[c.vendor] = (acc[c.vendor] || 0) + 1;
                return acc;
            }, {}),
            cases: bgvCases,
        };
    }

    return reports;
}

/**
 * Export HR report data
 */
export async function exportHRReport(organizationId, reportType, filters = {}) {
    const reports = await getHRReports(organizationId, filters);
    
    if (reportType === 'onboarding' && reports.onboarding) {
        const header = ['Workflow ID', 'Employee', 'Department', 'Status', 'Progress', 'Joining Date', 'Created At'];
        const rows = reports.onboarding.workflows.map(w => [
            w._id,
            `"${w.employeeId?.firstName || ''} ${w.employeeId?.lastName || ''}"`,
            w.employeeId?.department || '',
            w.status,
            w.progress || 0,
            w.joiningDate || '',
            w.createdAt || '',
        ].join(','));
        return [header.join(','), ...rows].join('\n');
    }

    if (reportType === 'offboarding' && reports.offboarding) {
        const header = ['Workflow ID', 'Employee', 'Department', 'Status', 'Last Working Day', 'Created At'];
        const rows = reports.offboarding.workflows.map(w => [
            w._id,
            `"${w.employeeId?.firstName || ''} ${w.employeeId?.lastName || ''}"`,
            w.employeeId?.department || '',
            w.status,
            w.lastWorkingDay || '',
            w.createdAt || '',
        ].join(','));
        return [header.join(','), ...rows].join('\n');
    }

    if (reportType === 'bgv' && reports.bgv) {
        const header = ['Case ID', 'Employee', 'Vendor', 'Overall Status', 'Checks', 'Created At'];
        const rows = reports.bgv.cases.map(c => [
            c._id,
            `"${c.employeeId?.firstName || ''} ${c.employeeId?.lastName || ''}"`,
            c.vendor,
            c.overallStatus,
            c.checks?.length || 0,
            c.createdAt || '',
        ].join(','));
        return [header.join(','), ...rows].join('\n');
    }

    throw new Error('Invalid report type');
}

/**
 * Get all workflows with full HR visibility
 */
export async function getAllWorkflows(organizationId, filters = {}) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    
    const result = {
        onboarding: [],
        offboarding: [],
    };

    if (isFeatureEnabled(settings, 'onboarding')) {
        const onboardingQuery = {
            organizationId,
            isTemplate: { $ne: true },
            ...(filters.status ? { status: filters.status } : {}),
            ...(filters.search ? {
                $or: [
                    { 'employee.firstName': new RegExp(filters.search, 'i') },
                    { 'employee.lastName': new RegExp(filters.search, 'i') },
                    { 'employee.email': new RegExp(filters.search, 'i') },
                ],
            } : {}),
        };

        result.onboarding = await OnboardingWorkflow.find(onboardingQuery)
            .populate('employeeId', 'firstName lastName email department jobTitle')
            .populate('assignedManager', 'firstName lastName')
            .populate('assignedBuddy', 'firstName lastName')
            .sort({ createdAt: -1 })
            .limit(filters.limit || 100)
            .lean();
    }

    if (isFeatureEnabled(settings, 'offboarding')) {
        const offboardingQuery = {
            organizationId,
            isTemplate: { $ne: true },
            ...(filters.status ? { status: filters.status } : {}),
            ...(filters.search ? {
                $or: [
                    { 'employee.firstName': new RegExp(filters.search, 'i') },
                    { 'employee.lastName': new RegExp(filters.search, 'i') },
                    { 'employee.email': new RegExp(filters.search, 'i') },
                ],
            } : {}),
        };

        result.offboarding = await OffboardingWorkflow.find(offboardingQuery)
            .populate('employeeId', 'firstName lastName email department jobTitle')
            .populate('assignedManager', 'firstName lastName')
            .sort({ createdAt: -1 })
            .limit(filters.limit || 100)
            .lean();
    }

    return result;
}
