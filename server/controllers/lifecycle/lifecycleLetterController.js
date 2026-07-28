import { getOrganizationId } from '../../helpers/organizationHelper.js';
import {
    listLetterTemplates,
    getLetterTemplate,
    createLetterTemplate,
    updateLetterTemplate,
    cloneLetterTemplate,
    publishLetterTemplate,
    archiveLetterTemplate,
    previewLetterTemplate,
    generateLetter,
    bulkGenerateLetters,
    sendLetter,
    resendLetter,
    acknowledgeLetter,
    markLetterViewed,
    listGeneratedLetters,
    buildLetterReports,
    exportLettersCsv,
    LIFECYCLE_LETTER_TYPES,
    LIFECYCLE_LETTER_PLACEHOLDERS,
} from '../../services/lifecycleLetterService.js';

const orgId = (req) => getOrganizationId(req);
const actor = (req) => req.employee || req.user;

export const getLetterTypes = async (_req, res) => {
    return res.json({ success: true, data: { types: LIFECYCLE_LETTER_TYPES, placeholders: LIFECYCLE_LETTER_PLACEHOLDERS } });
};

export const listLetterTemplatesHandler = async (req, res) => {
    try {
        const templates = await listLetterTemplates(orgId(req), req.query);
        return res.json({ success: true, data: templates });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getLetterTemplateHandler = async (req, res) => {
    try {
        const tpl = await getLetterTemplate(orgId(req), req.params.id);
        return res.json({ success: true, data: tpl });
    } catch (error) {
        return res.status(404).json({ success: false, message: error.message });
    }
};

export const createLetterTemplateHandler = async (req, res) => {
    try {
        const tpl = await createLetterTemplate(orgId(req), req.body, { actor: actor(req), req });
        return res.status(201).json({ success: true, data: tpl, message: 'Template created' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const updateLetterTemplateHandler = async (req, res) => {
    try {
        const tpl = await updateLetterTemplate(orgId(req), req.params.id, req.body, { actor: actor(req), req });
        return res.json({ success: true, data: tpl, message: 'Template saved' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const cloneLetterTemplateHandler = async (req, res) => {
    try {
        const tpl = await cloneLetterTemplate(orgId(req), req.params.id, { name: req.body.name, actor: actor(req), req });
        return res.status(201).json({ success: true, data: tpl, message: 'Template cloned' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const publishLetterTemplateHandler = async (req, res) => {
    try {
        const tpl = await publishLetterTemplate(orgId(req), req.params.id, { actor: actor(req), req });
        return res.json({ success: true, data: tpl, message: 'Template published' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const archiveLetterTemplateHandler = async (req, res) => {
    try {
        const tpl = await archiveLetterTemplate(orgId(req), req.params.id, { actor: actor(req), req });
        return res.json({ success: true, data: tpl, message: 'Template archived' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const previewLetterTemplateHandler = async (req, res) => {
    try {
        const preview = await previewLetterTemplate(orgId(req), req.params.id, req.body);
        return res.json({ success: true, data: preview });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const generateLetterHandler = async (req, res) => {
    try {
        const letter = await generateLetter({
            organizationId: orgId(req),
            templateId: req.body.templateId,
            employeeId: req.body.employeeId,
            candidateId: req.body.candidateId,
            workflowId: req.body.workflowId,
            workflowType: req.body.workflowType,
            customData: req.body.customData,
            actor: actor(req),
            req,
        });
        return res.status(201).json({ success: true, data: letter, message: 'Letter generated' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const bulkGenerateLettersHandler = async (req, res) => {
    try {
        const result = await bulkGenerateLetters(orgId(req), req.body, { actor: actor(req), req });
        return res.json({ success: true, data: result });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const sendLetterHandler = async (req, res) => {
    try {
        const letter = await sendLetter(orgId(req), req.params.id, { actor: actor(req), req });
        return res.json({ success: true, data: letter, message: 'Letter sent' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const resendLetterHandler = async (req, res) => {
    try {
        const letter = await resendLetter(orgId(req), req.params.id, { actor: actor(req), req });
        return res.json({ success: true, data: letter, message: 'Letter resent' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const listGeneratedLettersHandler = async (req, res) => {
    try {
        const letters = await listGeneratedLetters(orgId(req), req.query);
        const report = buildLetterReports(letters);
        return res.json({ success: true, data: letters, report });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const exportLettersHandler = async (req, res) => {
    try {
        const letters = await listGeneratedLetters(orgId(req), req.query);
        const csv = exportLettersCsv(letters);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="lifecycle-letters.csv"');
        return res.send(csv);
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const acknowledgeLetterHandler = async (req, res) => {
    try {
        const letter = await acknowledgeLetter(orgId(req), req.params.id, { actor: actor(req) });
        return res.json({ success: true, data: letter, message: 'Acknowledged' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const viewLetterHandler = async (req, res) => {
    try {
        const letter = await markLetterViewed(orgId(req), req.params.id);
        return res.json({ success: true, data: letter });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const listMyLetters = async (req, res) => {
    try {
        const employeeId = actor(req)?._id;
        const letters = await listGeneratedLetters(orgId(req), {
            employeeId,
            status: req.query.status,
        });
        return res.json({ success: true, data: letters });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
