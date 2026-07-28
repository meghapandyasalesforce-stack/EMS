/**
 * HR Experience Controller - Full visibility, bulk actions, reports, approvals
 */

import { getOrganizationId } from '../../helpers/organizationHelper.js';
import {
    getHRDashboard,
    bulkUpdateWorkflowStatus,
    bulkAssignManager,
    bulkAssignBuddy,
    getHRPendingApprovals,
    getHRReports,
    exportHRReport,
    getAllWorkflows,
} from '../../services/lifecycleHRService.js';

const orgId = (req) => getOrganizationId(req);
const actor = (req) => req.employee || req.user;

/**
 * GET /api/v1/admin/lifecycle/hr/dashboard
 * Get HR dashboard with comprehensive statistics
 */
export const getHRDashboardHandler = async (req, res) => {
    try {
        const dashboard = await getHRDashboard(orgId(req));
        return res.json({ success: true, data: dashboard });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/v1/admin/lifecycle/hr/bulk/status
 * Bulk update workflow statuses
 */
export const bulkUpdateStatusHandler = async (req, res) => {
    try {
        const results = await bulkUpdateWorkflowStatus(
            orgId(req),
            req.body.workflowIds,
            { status: req.body.status, actor: actor(req), req }
        );
        return res.json({ success: true, data: results });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/v1/admin/lifecycle/hr/bulk/assign-manager
 * Bulk assign manager to workflows
 */
export const bulkAssignManagerHandler = async (req, res) => {
    try {
        const results = await bulkAssignManager(
            orgId(req),
            req.body.workflowIds,
            req.body.managerId,
            { actor: actor(req), req }
        );
        return res.json({ success: true, data: results });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/v1/admin/lifecycle/hr/bulk/assign-buddy
 * Bulk assign buddy to workflows
 */
export const bulkAssignBuddyHandler = async (req, res) => {
    try {
        const results = await bulkAssignBuddy(
            orgId(req),
            req.body.workflowIds,
            req.body.buddyId,
            { actor: actor(req), req }
        );
        return res.json({ success: true, data: results });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/v1/admin/lifecycle/hr/pending-approvals
 * Get pending approvals for HR
 */
export const getHRPendingApprovalsHandler = async (req, res) => {
    try {
        const approvals = await getHRPendingApprovals(orgId(req));
        return res.json({ success: true, data: approvals });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/v1/admin/lifecycle/hr/reports
 * Get HR reports with filters
 */
export const getHRReportsHandler = async (req, res) => {
    try {
        const reports = await getHRReports(orgId(req), req.query);
        return res.json({ success: true, data: reports });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/v1/admin/lifecycle/hr/reports/export
 * Export HR report data
 */
export const exportHRReportHandler = async (req, res) => {
    try {
        const csv = await exportHRReport(orgId(req), req.query.type, req.query);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="hr-report-${req.query.type}-${Date.now()}.csv"`);
        return res.send(csv);
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/v1/admin/lifecycle/hr/workflows
 * Get all workflows with full HR visibility
 */
export const getAllWorkflowsHandler = async (req, res) => {
    try {
        const workflows = await getAllWorkflows(orgId(req), req.query);
        return res.json({ success: true, data: workflows });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
