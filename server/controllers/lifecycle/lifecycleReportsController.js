import {
    getLifecycleDashboard,
    getLifecycleReportDrilldown,
    exportLifecycleReport,
    getReportingPolicy,
    listScheduledReports,
    createScheduledReport,
    updateScheduledReport,
    deleteScheduledReport,
    LIFECYCLE_REPORT_CATEGORIES,
    LIFECYCLE_SCHEDULE_FREQUENCIES,
} from '../../services/lifecycleReportsService.js';
import { LIFECYCLE_REPORT_SECTIONS, LIFECYCLE_REPORT_EXPORT_FORMATS } from '../../constants/lifecycleReports.js';

const orgId = (req) => req.organizationId || req.user?.organizationId;

export const getReportsCatalogHandler = async (req, res) => {
    try {
        const policy = await getReportingPolicy(orgId(req));
        return res.json({
            success: true,
            data: {
                sections: LIFECYCLE_REPORT_SECTIONS,
                categories: LIFECYCLE_REPORT_CATEGORIES,
                exportFormats: LIFECYCLE_REPORT_EXPORT_FORMATS,
                scheduleFrequencies: LIFECYCLE_SCHEDULE_FREQUENCIES,
                policy,
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getLifecycleDashboardHandler = async (req, res) => {
    try {
        const dashboard = await getLifecycleDashboard(orgId(req), req.query);
        return res.json({ success: true, data: dashboard });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getLifecycleDrilldownHandler = async (req, res) => {
    try {
        const rows = await getLifecycleReportDrilldown(orgId(req), req.params.category, req.query);
        return res.json({ success: true, data: rows, category: req.params.category });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const exportLifecycleReportHandler = async (req, res) => {
    try {
        const policy = await getReportingPolicy(orgId(req));
        if (!policy.allowExport) {
            return res.status(403).json({ success: false, message: 'Report export is disabled for this organization' });
        }
        const result = await exportLifecycleReport(orgId(req), {
            category: req.params.category || req.query.category || 'onboarding',
            format: req.query.format || 'csv',
            filters: req.query,
        });
        res.setHeader('Content-Type', result.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
        return res.send(result.body);
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const listScheduledReportsHandler = async (req, res) => {
    try {
        const reports = await listScheduledReports(orgId(req));
        return res.json({ success: true, data: reports });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const createScheduledReportHandler = async (req, res) => {
    try {
        const policy = await getReportingPolicy(orgId(req));
        if (!policy.allowScheduledReports) {
            return res.status(403).json({ success: false, message: 'Scheduled reports are disabled' });
        }
        const report = await createScheduledReport(orgId(req), req.body, {
            actor: req.employee,
            req,
        });
        return res.status(201).json({ success: true, data: report, message: 'Scheduled report created' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const updateScheduledReportHandler = async (req, res) => {
    try {
        const report = await updateScheduledReport(orgId(req), req.params.id, req.body, {
            actor: req.employee,
            req,
        });
        return res.json({ success: true, data: report, message: 'Scheduled report updated' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const deleteScheduledReportHandler = async (req, res) => {
    try {
        await deleteScheduledReport(orgId(req), req.params.id, { actor: req.employee, req });
        return res.json({ success: true, message: 'Scheduled report deleted' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};
