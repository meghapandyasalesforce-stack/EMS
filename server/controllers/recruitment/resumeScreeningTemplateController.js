import asyncHandler from '../../middlewares/asyncHandler.js';
import ResumeScreeningTemplate from '../../models/resumeScreeningTemplate.model.js';
import {
    normalizeMinimumMatchPercent,
    normalizeKeywordList,
} from '../../services/resumeScreeningService.js';

const getOrganizationId = (req) =>
    req.employee?.organizationId || req.user?.organizationId || req.organizationId;

const getActorId = (req) => req.employee?._id || req.user?._id || null;

/**
 * GET /api/v1/admin/recruitment/screening/templates
 * Query: activeOnly=true → only active templates
 */
export const listScreeningTemplates = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const query = { organizationId };
    if (req.query.activeOnly === 'true') query.isActive = true;

    const templates = await ResumeScreeningTemplate.find(query)
        .sort({ name: 1 })
        .lean();

    res.json({ success: true, data: templates });
});

/**
 * GET /api/v1/admin/recruitment/screening/templates/:id
 */
export const getScreeningTemplate = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const template = await ResumeScreeningTemplate.findOne({
        _id: req.params.id,
        organizationId,
    }).lean();

    if (!template) {
        return res.status(404).json({ success: false, message: 'Template not found' });
    }
    res.json({ success: true, data: template });
});

/**
 * POST /api/v1/admin/recruitment/screening/templates
 */
export const createScreeningTemplate = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const {
        name,
        requiredKeywords,
        optionalKeywords,
        minimumMatchPercent,
        isActive,
    } = req.body || {};

    if (!name || !String(name).trim()) {
        return res.status(400).json({ success: false, message: 'Template name is required' });
    }

    try {
        const template = await ResumeScreeningTemplate.create({
            organizationId,
            name: String(name).trim(),
            requiredKeywords: normalizeKeywordList(requiredKeywords),
            optionalKeywords: normalizeKeywordList(optionalKeywords),
            minimumMatchPercent: normalizeMinimumMatchPercent(minimumMatchPercent, 70),
            isActive: isActive !== false,
            createdBy: getActorId(req),
            updatedBy: getActorId(req),
        });
        res.status(201).json({ success: true, message: 'Template created', data: template });
    } catch (err) {
        if (err?.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'A template with this name already exists',
            });
        }
        throw err;
    }
});

/**
 * PUT /api/v1/admin/recruitment/screening/templates/:id
 */
export const updateScreeningTemplate = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const template = await ResumeScreeningTemplate.findOne({
        _id: req.params.id,
        organizationId,
    });
    if (!template) {
        return res.status(404).json({ success: false, message: 'Template not found' });
    }

    const {
        name,
        requiredKeywords,
        optionalKeywords,
        minimumMatchPercent,
        isActive,
    } = req.body || {};

    if (name != null) {
        const trimmed = String(name).trim();
        if (!trimmed) {
            return res.status(400).json({ success: false, message: 'Template name is required' });
        }
        template.name = trimmed;
    }
    if (requiredKeywords != null) template.requiredKeywords = normalizeKeywordList(requiredKeywords);
    if (optionalKeywords != null) template.optionalKeywords = normalizeKeywordList(optionalKeywords);
    if (minimumMatchPercent != null) {
        template.minimumMatchPercent = normalizeMinimumMatchPercent(
            minimumMatchPercent,
            template.minimumMatchPercent
        );
    }
    if (isActive != null) template.isActive = !!isActive;
    template.updatedBy = getActorId(req);

    try {
        await template.save();
        res.json({ success: true, message: 'Template updated', data: template });
    } catch (err) {
        if (err?.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'A template with this name already exists',
            });
        }
        throw err;
    }
});

/**
 * POST .../activate | .../deactivate
 */
export const activateScreeningTemplate = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const template = await ResumeScreeningTemplate.findOneAndUpdate(
        { _id: req.params.id, organizationId },
        { isActive: true, updatedBy: getActorId(req) },
        { new: true }
    );
    if (!template) {
        return res.status(404).json({ success: false, message: 'Template not found' });
    }
    res.json({ success: true, message: 'Template activated', data: template });
});

export const deactivateScreeningTemplate = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const template = await ResumeScreeningTemplate.findOneAndUpdate(
        { _id: req.params.id, organizationId },
        { isActive: false, updatedBy: getActorId(req) },
        { new: true }
    );
    if (!template) {
        return res.status(404).json({ success: false, message: 'Template not found' });
    }
    res.json({ success: true, message: 'Template deactivated', data: template });
});

/**
 * DELETE /api/v1/admin/recruitment/screening/templates/:id
 * Does not affect jobs that already copied criteria from this template.
 */
export const deleteScreeningTemplate = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const deleted = await ResumeScreeningTemplate.findOneAndDelete({
        _id: req.params.id,
        organizationId,
    });
    if (!deleted) {
        return res.status(404).json({ success: false, message: 'Template not found' });
    }
    res.json({ success: true, message: 'Template deleted', data: { id: deleted._id } });
});
