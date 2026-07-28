import { getOrganizationId } from '../../helpers/organizationHelper.js';
import {
    listForms,
    getFormById,
    createForm,
    updateForm,
    cloneForm,
    publishForm,
    archiveForm,
    rollbackFormVersion,
    previewForm,
    assignFormToWorkflow,
    saveFormResponseDraft,
    submitFormResponse,
    listFormResponses,
    buildFormReport,
    exportResponsesCsv,
    reviewFormResponse,
    addFormAttachment,
    removeFormAttachment,
    getFormResponseWithHistory,
    rollbackFormResponse,
} from '../../services/lifecycleFormService.js';
import { LIFECYCLE_FORM_FIELD_TYPES } from '../../constants/lifecycleSharedSchemas.js';

const orgId = (req) => getOrganizationId(req);
const actor = (req) => req.employee || req.user;

export const getFormFieldTypes = async (_req, res) => {
    return res.json({ success: true, data: LIFECYCLE_FORM_FIELD_TYPES });
};

export const listLifecycleForms = async (req, res) => {
    try {
        const forms = await listForms(orgId(req), {
            category: req.query.category,
            status: req.query.status,
            featureKey: req.query.featureKey,
            activeOnly: req.query.activeOnly !== '0',
        });
        return res.json({ success: true, data: forms });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getLifecycleForm = async (req, res) => {
    try {
        const form = await getFormById(orgId(req), req.params.id);
        return res.json({ success: true, data: form });
    } catch (error) {
        return res.status(404).json({ success: false, message: error.message });
    }
};

export const createLifecycleForm = async (req, res) => {
    try {
        const form = await createForm(orgId(req), req.body, { actor: actor(req), req });
        return res.status(201).json({ success: true, data: form, message: 'Form created' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const updateLifecycleForm = async (req, res) => {
    try {
        const form = await updateForm(orgId(req), req.params.id, req.body, { actor: actor(req), req });
        return res.json({ success: true, data: form, message: 'Form saved' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const cloneLifecycleForm = async (req, res) => {
    try {
        const form = await cloneForm(orgId(req), req.params.id, { name: req.body.name, actor: actor(req), req });
        return res.status(201).json({ success: true, data: form, message: 'Form cloned' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const publishLifecycleForm = async (req, res) => {
    try {
        const form = await publishForm(orgId(req), req.params.id, { actor: actor(req), req });
        return res.json({ success: true, data: form, message: 'Form published' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const archiveLifecycleForm = async (req, res) => {
    try {
        const form = await archiveForm(orgId(req), req.params.id, { actor: actor(req), req });
        return res.json({ success: true, data: form, message: 'Form archived' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const rollbackLifecycleForm = async (req, res) => {
    try {
        const form = await rollbackFormVersion(orgId(req), req.params.id, Number(req.body.version), { actor: actor(req), req });
        return res.json({ success: true, data: form, message: `Rolled back to v${req.body.version}` });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const previewLifecycleForm = async (req, res) => {
    try {
        const preview = await previewForm(orgId(req), req.params.id);
        return res.json({ success: true, data: preview });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const assignLifecycleForm = async (req, res) => {
    try {
        const form = await assignFormToWorkflow(orgId(req), req.params.id, req.body, { actor: actor(req), req });
        return res.json({ success: true, data: form, message: 'Form assignment updated' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const getLifecycleFormResponses = async (req, res) => {
    try {
        const responses = await listFormResponses(orgId(req), req.params.id, req.query);
        const form = await getFormById(orgId(req), req.params.id);
        const report = buildFormReport(responses);
        return res.json({ success: true, data: { responses, report } });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const exportLifecycleFormResponses = async (req, res) => {
    try {
        const form = await getFormById(orgId(req), req.params.id);
        const responses = await listFormResponses(orgId(req), req.params.id, req.query);
        const format = req.query.format || 'csv';
        if (format === 'csv') {
            const csv = exportResponsesCsv(form, responses);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="form-${form._id}-responses.csv"`);
            return res.send(csv);
        }
        return res.json({ success: true, data: responses, form: { id: form._id, name: form.name } });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const submitLifecycleFormResponse = async (req, res) => {
    try {
        const response = await submitFormResponse({
            organizationId: orgId(req),
            formId: req.params.id,
            responseId: req.body.responseId,
            responses: req.body.responses,
            employeeId: req.body.employeeId || actor(req)?._id,
            candidateId: req.body.candidateId,
            workflowId: req.body.workflowId,
            workflowType: req.body.workflowType,
            actor: actor(req),
            req,
        });
        return res.json({ success: true, data: response, message: 'Form submitted' });
    } catch (error) {
        if (error.validationErrors) {
            return res.status(422).json({ success: false, message: error.message, errors: error.validationErrors });
        }
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const saveLifecycleFormDraft = async (req, res) => {
    try {
        const response = await saveFormResponseDraft({
            organizationId: orgId(req),
            formId: req.params.id,
            responseId: req.body.responseId,
            responses: req.body.responses,
            employeeId: req.body.employeeId || actor(req)?._id,
            candidateId: req.body.candidateId,
            workflowId: req.body.workflowId,
            workflowType: req.body.workflowType,
            actor: actor(req),
        });
        return res.json({ success: true, data: response, message: 'Draft saved' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

// Backward-compatible handlers used by lifecycleConfigController
export const getFormDefinitions = listLifecycleForms;
export const saveFormDefinition = async (req, res) => {
    if (req.body.id) return updateLifecycleForm(req, res);
    return createLifecycleForm(req, res);
};
export const deleteFormDefinition = archiveLifecycleForm;

// Enhanced form response handlers
export const reviewFormResponseHandler = async (req, res) => {
    try {
        const response = await reviewFormResponse(
            orgId(req),
            req.params.responseId,
            {
                decision: req.body.decision,
                comments: req.body.comments,
                actor: actor(req),
                req,
            }
        );
        return res.json({ success: true, data: response, message: `Response ${req.body.decision}ed` });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const addFormAttachmentHandler = async (req, res) => {
    try {
        const response = await addFormAttachment(
            orgId(req),
            req.params.responseId,
            {
                fileName: req.body.fileName,
                fileUrl: req.body.fileUrl,
                fileType: req.body.fileType,
                fileSize: req.body.fileSize,
                uploadedBy: req.body.uploadedBy,
            },
            { actor: actor(req), req }
        );
        return res.json({ success: true, data: response, message: 'Attachment added' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const removeFormAttachmentHandler = async (req, res) => {
    try {
        const response = await removeFormAttachment(
            orgId(req),
            req.params.responseId,
            parseInt(req.params.attachmentIndex),
            { actor: actor(req), req }
        );
        return res.json({ success: true, data: response, message: 'Attachment removed' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const getFormResponseWithHistoryHandler = async (req, res) => {
    try {
        const response = await getFormResponseWithHistory(orgId(req), req.params.responseId);
        return res.json({ success: true, data: response });
    } catch (error) {
        return res.status(404).json({ success: false, message: error.message });
    }
};

export const rollbackFormResponseHandler = async (req, res) => {
    try {
        const response = await rollbackFormResponse(
            orgId(req),
            req.params.responseId,
            parseInt(req.params.version),
            { actor: actor(req), req }
        );
        return res.json({ success: true, data: response, message: 'Response rolled back' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};
