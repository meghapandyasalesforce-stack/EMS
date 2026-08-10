import { getOrganizationId } from '../../helpers/organizationHelper.js';
import {
    listPdfTemplateFieldOptions,
    uploadPdfOfferTemplate,
    getPdfTemplateTextItems,
    detectPdfTemplateFields,
    savePdfTemplateMappings,
    previewPdfOfferLetter,
} from '../../services/offerPdfTemplateService.js';

const orgId = (req) => getOrganizationId(req);
const actor = (req) => req.employee || req.user;

export const getPdfTemplateFields = async (_req, res) => {
    return res.json({ success: true, data: listPdfTemplateFieldOptions() });
};

export const postPdfTemplateUpload = async (req, res) => {
    try {
        req.organizationId = orgId(req);
        const result = await uploadPdfOfferTemplate({
            organizationId: orgId(req),
            file: req.file,
            name: req.body.name,
            description: req.body.description,
            actor: actor(req),
            req,
        });
        return res.status(201).json({
            success: true,
            data: result.template,
            meta: {
                hasSelectableText: result.hasSelectableText,
                extractedTextCount: result.extractedTextCount,
                detectedCount: result.detectedCount,
                detectionSummary: result.detectionSummary,
                verificationFields: result.verificationFields,
            },
            message: result.message,
        });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const getPdfTemplateExtract = async (req, res) => {
    try {
        const data = await getPdfTemplateTextItems(orgId(req), req.params.id);
        return res.json({ success: true, data });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const postPdfTemplateDetect = async (req, res) => {
    try {
        const data = await detectPdfTemplateFields(orgId(req), req.params.id, actor(req), req);
        return res.json({ success: true, data, message: 'Field detection completed' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const putPdfTemplateMappings = async (req, res) => {
    try {
        const template = await savePdfTemplateMappings(
            orgId(req),
            req.params.id,
            req.body.mappings,
            actor(req),
            req,
        );
        return res.json({ success: true, data: template, message: 'Template confirmed' });
    } catch (error) {
        if (error.code === 'PDF_MAPPING_INVALID') {
            return res.status(400).json({
                success: false,
                message: error.message,
                errors: error.errors,
            });
        }
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const postPdfOfferPreview = async (req, res) => {
    try {
        const { candidateId, ...payload } = req.body;
        if (!candidateId) {
            return res.status(400).json({ success: false, message: 'candidateId is required' });
        }
        const preview = await previewPdfOfferLetter({
            organizationId: orgId(req),
            candidateId,
            payload,
        });
        return res.json({ success: true, data: preview });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};
