import { getOrganizationId } from '../../helpers/organizationHelper.js';
import {
    getExitInterviewSettings,
    updateExitInterviewSettings,
    listExitInterviewTemplates,
    getExitInterviewTemplate,
    createExitInterviewTemplate,
    updateExitInterviewTemplate,
    publishExitInterviewTemplate,
    listExitInterviewSessions,
    getExitInterviewSession,
    scheduleExitInterviewSession,
    rescheduleExitInterviewSession,
    cancelExitInterviewSession,
    saveExitInterviewDraft,
    submitExitInterviewSession,
    closeExitInterviewSession,
    addExitInterviewActionItem,
    updateExitInterviewActionItem,
    getExitInterviewAnalytics,
    exportExitInterviewAnalyticsCsv,
    provisionExitInterviewSessions,
    EXIT_INTERVIEW_TYPES,
} from '../../services/lifecycleExitInterviewService.js';
import { ExitInterviewSession } from '../../models/lifecycle.model.js';

const orgId = (req) => getOrganizationId(req);
const actor = (req) => req.employee || req.user;

export const getExitInterviewTypes = async (_req, res) => {
    return res.json({ success: true, data: EXIT_INTERVIEW_TYPES });
};

export const getExitInterviewSettingsHandler = async (req, res) => {
    try {
        const settings = await getExitInterviewSettings(orgId(req));
        return res.json({ success: true, data: settings });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const patchExitInterviewSettingsHandler = async (req, res) => {
    try {
        const settings = await updateExitInterviewSettings(orgId(req), req.body, { actor: actor(req), req });
        return res.json({ success: true, data: settings, message: 'Exit interview settings saved' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const listExitInterviewTemplatesHandler = async (req, res) => {
    try {
        const templates = await listExitInterviewTemplates(orgId(req), req.query);
        return res.json({ success: true, data: templates });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getExitInterviewTemplateHandler = async (req, res) => {
    try {
        const tpl = await getExitInterviewTemplate(orgId(req), req.params.id);
        return res.json({ success: true, data: tpl });
    } catch (error) {
        return res.status(404).json({ success: false, message: error.message });
    }
};

export const createExitInterviewTemplateHandler = async (req, res) => {
    try {
        const tpl = await createExitInterviewTemplate(orgId(req), req.body, { actor: actor(req), req });
        return res.status(201).json({ success: true, data: tpl, message: 'Template created' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const updateExitInterviewTemplateHandler = async (req, res) => {
    try {
        const tpl = await updateExitInterviewTemplate(orgId(req), req.params.id, req.body, { actor: actor(req), req });
        return res.json({ success: true, data: tpl, message: 'Template saved' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const publishExitInterviewTemplateHandler = async (req, res) => {
    try {
        const tpl = await publishExitInterviewTemplate(orgId(req), req.params.id, { actor: actor(req), req });
        return res.json({ success: true, data: tpl, message: 'Template published' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const listExitInterviewSessionsHandler = async (req, res) => {
    try {
        const sessions = await listExitInterviewSessions(orgId(req), req.query);
        return res.json({ success: true, data: sessions });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getExitInterviewSessionHandler = async (req, res) => {
    try {
        const session = await getExitInterviewSession(orgId(req), req.params.id);
        return res.json({ success: true, data: session });
    } catch (error) {
        return res.status(404).json({ success: false, message: error.message });
    }
};

export const scheduleExitInterviewSessionHandler = async (req, res) => {
    try {
        const session = await scheduleExitInterviewSession(orgId(req), req.params.id, {
            scheduledDate: req.body.scheduledDate,
            conductorId: req.body.conductorId,
            actor: actor(req),
            req,
        });
        return res.json({ success: true, data: session, message: 'Interview scheduled' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const rescheduleExitInterviewSessionHandler = async (req, res) => {
    try {
        const session = await rescheduleExitInterviewSession(orgId(req), req.params.id, req.body, { actor: actor(req), req });
        return res.json({ success: true, data: session, message: 'Interview rescheduled' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const cancelExitInterviewSessionHandler = async (req, res) => {
    try {
        const session = await cancelExitInterviewSession(orgId(req), req.params.id, {
            reason: req.body.reason,
            actor: actor(req),
            req,
        });
        return res.json({ success: true, data: session, message: 'Interview cancelled' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const saveExitInterviewDraftHandler = async (req, res) => {
    try {
        const session = await saveExitInterviewDraft(orgId(req), req.params.id, {
            ...req.body,
            actor: actor(req),
        });
        return res.json({ success: true, data: session, message: 'Draft saved' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const submitExitInterviewSessionHandler = async (req, res) => {
    try {
        const session = await submitExitInterviewSession(orgId(req), req.params.id, req.body, {
            actor: actor(req),
            req,
        });
        return res.json({ success: true, data: session, message: 'Interview submitted' });
    } catch (error) {
        if (error.validationErrors) {
            return res.status(422).json({ success: false, message: error.message, errors: error.validationErrors });
        }
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const closeExitInterviewSessionHandler = async (req, res) => {
    try {
        const session = await closeExitInterviewSession(orgId(req), req.params.id, { actor: actor(req), req });
        return res.json({ success: true, data: session, message: 'Interview closed' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const addExitInterviewActionItemHandler = async (req, res) => {
    try {
        const session = await addExitInterviewActionItem(orgId(req), req.params.id, req.body, { actor: actor(req) });
        return res.json({ success: true, data: session, message: 'Action item added' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const updateExitInterviewActionItemHandler = async (req, res) => {
    try {
        const session = await updateExitInterviewActionItem(orgId(req), req.params.id, req.params.itemId, req.body, { actor: actor(req) });
        return res.json({ success: true, data: session, message: 'Action item updated' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const getExitInterviewAnalyticsHandler = async (req, res) => {
    try {
        const analytics = await getExitInterviewAnalytics(orgId(req), req.query);
        return res.json({ success: true, data: analytics });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const exportExitInterviewAnalyticsHandler = async (req, res) => {
    try {
        const sessions = await ExitInterviewSession.find({ organizationId: orgId(req) })
            .populate('employeeId', 'department')
            .lean();
        const csv = exportExitInterviewAnalyticsCsv(sessions);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="exit-interview-analytics.csv"');
        return res.send(csv);
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const provisionExitInterviewSessionsHandler = async (req, res) => {
    try {
        const { OffboardingWorkflow } = await import('../../models/onboarding.model.js');
        const workflow = await OffboardingWorkflow.findOne({ _id: req.params.workflowId, organizationId: orgId(req) });
        if (!workflow) return res.status(404).json({ success: false, message: 'Workflow not found' });
        const sessions = await provisionExitInterviewSessions(workflow, { actor: actor(req) });
        await workflow.save();
        return res.json({ success: true, data: sessions, message: 'Exit interview sessions provisioned' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const listMyExitInterviewSessions = async (req, res) => {
    try {
        const employeeId = actor(req)?._id;
        const sessions = await listExitInterviewSessions(orgId(req), {
            employeeId: req.query.asConductor === '1' ? undefined : employeeId,
            conductorId: req.query.asConductor === '1' ? employeeId : undefined,
            status: req.query.status,
        });
        return res.json({ success: true, data: sessions });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
