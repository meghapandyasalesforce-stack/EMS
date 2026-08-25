/**
 * PDF-based Offer Letter templates — isolated from HTML template flow.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { Candidate, Recruitment } from '../models/recruitment.model.js';
import Organization from '../models/organization.model.js';
import { OfferLetter, OfferLetterTemplate } from '../models/lifecycleGap.model.js';
import {
    OFFER_PLACEHOLDER_DEFINITIONS,
    buildOfferPlaceholderMap,
    applyPdfDateFormatting,
    amountToWordsINR,
} from '../helpers/offerPlaceholderResolver.js';
import {
    extractPdfTextItems,
    hasSelectableText,
} from '../helpers/pdfTextExtractor.js';
import {
    detectPdfFields,
    detectionsToFieldMappings,
    buildVerificationFieldList,
} from '../helpers/pdfFieldDetector.js';
import { fillPdfTemplateMappings } from '../helpers/pdfTemplateFiller.js';
import {
    normalizeSavedMapping,
    validatePdfMappingConfig,
    validatePdfMappingsAgainstPlaceholders,
    stripExcludedPdfMappings,
} from '../helpers/pdfPlaceholderMappings.js';
import { filterSafePdfMappings } from '../helpers/pdfMappingSafety.js';
import { uploadFile, buildS3Key, getSignedUrl, extractS3Key } from '../helpers/storageHelper.js';
import { assertFeatureEnabled, getOrCreateLifecycleSettings } from './lifecycleConfigService.js';
import { logLifecycleAudit } from './lifecycleAuditService.js';
import logger from '../helpers/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PDF_TEMPLATE_FIELD_GROUPS = Object.freeze([
    {
        group: 'Candidate Information',
        // Email intentionally excluded — company letterhead emails must stay static
        fields: ['candidateName', 'phone'],
    },
    {
        group: 'Job Information',
        fields: ['position', 'department', 'reportingManager', 'employmentType', 'location', 'companyName'],
    },
    {
        group: 'Offer Information',
        fields: [
            'offerDate', 'startDate', 'annualCTC', 'salaryWords', 'basicSalary', 'basicSalaryAnnual',
            'hra', 'hraAnnual', 'specialAllowance', 'specialAllowanceAnnual',
            'otherAllowance', 'grossSalary', 'grossSalaryAnnual',
            'employeePF', 'employeePFAnnual', 'employeeESI', 'employeeESIAnnual',
            'employerPF', 'employerPFAnnual', 'employerESI', 'employerESIAnnual',
            'gratuity', 'gratuityAnnual', 'totalDeductions', 'totalDeductionsAnnual',
            'professionalTax', 'tds', 'totalCTC', 'totalCTCMonthly', 'probationPeriod', 'noticePeriod',
            'workingHours', 'leaveEntitlement',
        ],
    },
]);

export function listPdfTemplateFieldOptions() {
    const labelByToken = new Map(OFFER_PLACEHOLDER_DEFINITIONS.map((d) => [d.token, d.label]));
    labelByToken.set('totalCTCMonthly', 'Total CTC (Monthly)');
    labelByToken.set('basicSalaryAnnual', 'Basic Salary (Annual)');
    labelByToken.set('hraAnnual', 'HRA (Annual)');
    labelByToken.set('specialAllowanceAnnual', 'Special Allowance (Annual)');
    labelByToken.set('grossSalaryAnnual', 'Gross Salary (Annual)');
    labelByToken.set('employeePFAnnual', 'Employee PF (Annual)');
    labelByToken.set('employeeESIAnnual', 'Employee ESI (Annual)');
    labelByToken.set('employerPFAnnual', 'Employer PF (Annual)');
    labelByToken.set('employerESIAnnual', 'Employer ESI (Annual)');
    labelByToken.set('gratuityAnnual', 'Gratuity (Annual)');
    labelByToken.set('totalDeductionsAnnual', 'Total Deductions (Annual)');
    return PDF_TEMPLATE_FIELD_GROUPS.map((group) => ({
        group: group.group,
        fields: group.fields.map((token) => ({
            token,
            label: labelByToken.get(token) || token,
            placeholderToken: `{{${token}}}`,
        })),
    }));
}

function loadOfferContextJob(organizationId, candidate) {
    if (!candidate?.jobPostingId) return Promise.resolve(null);
    return Recruitment.findOne({ _id: candidate.jobPostingId, organizationId })
        .populate('hiringManager', 'name firstName lastName')
        .lean();
}

async function resolvePdfOfferContext({
    organizationId,
    candidate,
    template,
    offerDraft,
    payload,
    settings,
}) {
    const org = await Organization.findById(organizationId)
        .select('name legalName email phone website address workingHours')
        .lean();
    const job = await loadOfferContextJob(organizationId, candidate);
    const annualCtcRaw = offerDraft?.salary ?? payload.salary ?? candidate?.offerDetails?.salary;
    const placeholderMap = buildOfferPlaceholderMap({
        candidate,
        org,
        offer: offerDraft,
        job,
        settings,
        payload,
    });

    const rawDates = {
        startDate: offerDraft?.startDate ?? payload.startDate ?? candidate?.offerDetails?.startDate,
        offerDate: offerDraft?.createdAt ?? payload.offerDate ?? new Date(),
        offerExpiryDate: offerDraft?.expiryDate ?? payload.expiryDate,
        currentDate: new Date(),
    };

    return {
        placeholderMap: applyPdfMonthlyAmountRounding(
            applyPdfSalaryWordsFormatting(
                applyPdfDateFormatting(placeholderMap, rawDates),
                annualCtcRaw,
            ),
        ),
        org,
        job,
    };
}

/** PDF offer letters typically use "Rupees … Only"; keep HTML amountToWordsINR unchanged. */
function formatSalaryWordsForPdf(amount) {
    const standard = amountToWordsINR(amount);
    if (!standard) return '';
    const flipped = standard.replace(/^(.+?)\s+Rupees Only$/i, 'Rupees $1 Only');
    return flipped || standard;
}

function applyPdfSalaryWordsFormatting(placeholderMap = {}, annualCtc) {
    const result = { ...placeholderMap };
    const words = formatSalaryWordsForPdf(annualCtc);
    if (!words) return result;
    result['{{salaryWords}}'] = words;
    result['{{annualCTCInWords}}'] = words;
    return result;
}

/**
 * PDF display-only: round monthly currency placeholders that come from annual/12
 * (e.g. 16,666.666… → 16,667). Does not change salary calculation / HTML offers.
 */
const PDF_MONTHLY_AMOUNT_TOKENS = Object.freeze([
    'basicSalary', 'hra', 'specialAllowance', 'otherAllowance', 'grossSalary',
    'employeePF', 'employeeESI', 'employerPF', 'employerESI', 'gratuity',
    'totalDeductions', 'totalCTCMonthly', 'professionalTax', 'tds',
]);

function applyPdfMonthlyAmountRounding(placeholderMap = {}) {
    const result = { ...placeholderMap };
    for (const token of PDF_MONTHLY_AMOUNT_TOKENS) {
        const key = `{{${token}}}`;
        const raw = result[key];
        if (raw == null || raw === '') continue;
        const match = String(raw).match(/([\d,]+(?:\.\d+)?)/);
        if (!match) continue;
        const n = Number(String(match[1]).replace(/,/g, ''));
        if (!Number.isFinite(n) || Number.isInteger(n)) continue;
        const rounded = Math.round(n);
        const prefix = String(raw).match(/^(?:Rs\.?\s*|INR\s*)/i)?.[0] || '';
        result[key] = `${prefix}${rounded.toLocaleString('en-IN')}`;
    }
    return result;
}

export function validatePdfTemplateMappings(template, placeholderMap) {
    return validatePdfMappingsAgainstPlaceholders(
        template.pdfTemplate?.fieldMappings || [],
        placeholderMap,
    );
}

function runFieldDetection(extractedTextItems) {
    if (!hasSelectableText(extractedTextItems)) {
        return {
            detectedFields: [],
            detectionStatus: 'no_text',
            detectionSummary: { high: 0, medium: 0, low: 0, notDetected: 0 },
        };
    }

    const result = detectPdfFields(extractedTextItems);
    return {
        detectedFields: result.detections,
        detectionStatus: result.detectionStatus,
        detectionSummary: result.summary,
    };
}

export async function detectPdfTemplateFields(organizationId, templateId, actor, req) {
    await assertFeatureEnabled(organizationId, 'offerLetter', 'Offer letter');
    const template = await OfferLetterTemplate.findOne({
        _id: templateId,
        organizationId,
        templateType: 'pdf',
    });
    if (!template) throw new Error('PDF template not found');

    const extractedTextItems = template.pdfTemplate?.extractedTextItems || [];

    const detection = runFieldDetection(extractedTextItems);
    template.pdfTemplate.detectedFields = detection.detectedFields;
    template.pdfTemplate.detectionStatus = detection.detectionStatus;
    template.pdfTemplate.lastDetectionAt = new Date();
    template.pdfTemplate.isVerified = false;
    template.pdfTemplate.mappingsConfigured = false;
    template.updatedBy = actor?._id;
    await template.save();

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'OfferTemplate',
        entityId: template._id,
        entityName: `${template.name} field detection`,
        req,
        actor,
    });

    return {
        templateId: template._id,
        templateName: template.name,
        hasSelectableText: template.pdfTemplate.hasSelectableText,
        detectionStatus: detection.detectionStatus,
        detectionSummary: detection.detectionSummary,
        detectedFields: detection.detectedFields,
        verificationFields: buildVerificationFieldList(detection.detectedFields),
        pdfUrl: template.pdfTemplate.pdfUrl,
    };
}

function assertPdfMappingsConfigured(template) {
    if (!template.pdfTemplate?.hasSelectableText) {
        throw new Error(
            'This PDF appears to be scanned or image-only and has no selectable text. '
            + 'Use a text-based PDF exported from Word or Google Docs, or set up an OCR-based template.',
        );
    }
    if (!template.pdfTemplate?.mappingsConfigured) {
        throw new Error(
            'PDF template fields are not verified. Open Offer Templates, review detected fields, '
            + 'and confirm the template before generating offers.',
        );
    }
    const mappings = template.pdfTemplate?.fieldMappings || [];
    if (!mappings.length) {
        throw new Error('PDF template has no saved field mappings. Map fields before generating offers.');
    }
    const configCheck = validatePdfMappingConfig(mappings, template.pdfTemplate?.extractedTextItems || []);
    if (!configCheck.ok) {
        const detail = configCheck.errors[0]?.message || 'Invalid field mapping configuration';
        throw new Error(detail);
    }
}

async function generateFilledPdfFile({
    organizationId,
    template,
    placeholderMap,
    fileName,
}) {
    const pdfS3Key = template.pdfTemplate?.pdfS3Key;
    if (!pdfS3Key) throw new Error('PDF template file not found in storage');

    // Download template from S3
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const s3Client = (await import('../config/s3.js')).default;
    const { S3_BUCKET } = await import('../config/s3.js');
    const response = await s3Client.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: pdfS3Key }));
    const chunks = [];
    for await (const chunk of response.Body) chunks.push(chunk);
    const templateBytes = Buffer.concat(chunks);

    const extractedTextItems = template.pdfTemplate?.extractedTextItems || [];
    const mappings = filterSafePdfMappings(
        stripExcludedPdfMappings(template.pdfTemplate?.fieldMappings || []),
        extractedTextItems,
    );

    const filled = await fillPdfTemplateMappings({
        templatePdfBytes: templateBytes,
        mappings,
        placeholderMap,
        extractedTextItems,
    });

    const safeName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
    const s3Key = buildS3Key('pdf-template', String(organizationId), `generated/${safeName}`);
    await uploadFile(filled, s3Key, 'application/pdf', false);
    const pdfUrl = s3Key; // stored as S3 key; use getSignedUrl to serve
    return { pdfUrl, pdfFileName: safeName };
}

export async function uploadPdfOfferTemplate({
    organizationId,
    file,
    name,
    description,
    actor,
    req,
}) {
    await assertFeatureEnabled(organizationId, 'offerLetter', 'Offer letter');
    if (!file) throw new Error('PDF file is required');
    if (!name?.trim()) throw new Error('Template name is required');

    const buffer = file.buffer;
    if (!buffer?.length) throw new Error('PDF file buffer is empty');

    let extractedTextItems = [];
    try {
        extractedTextItems = await extractPdfTextItems(buffer);
    } catch (error) {
        logger.warn('PDF text extraction failed', { error: error.message });
        throw new Error('Unable to read PDF file. Please upload a valid PDF.');
    }

    const selectable = hasSelectableText(extractedTextItems);
    const detection = runFieldDetection(extractedTextItems);

    // Upload template PDF to S3
    const safeName = String(file.originalname || 'template.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
    const s3Filename = `template-${Date.now()}-${safeName}`;
    const pdfS3Key = buildS3Key('pdf-template', String(organizationId), s3Filename);
    await uploadFile(buffer, pdfS3Key, 'application/pdf', false);
    const pdfUrl = pdfS3Key;

    const template = await OfferLetterTemplate.create({
        organizationId,
        name: name.trim(),
        description: description?.trim() || '',
        templateType: 'pdf',
        bodyHtml: '',
        pdfTemplate: {
            pdfUrl,
            pdfS3Key,
            pdfFileName: s3Filename,
            originalFileName: file.originalname,
            fileSize: file.size,
            hasSelectableText: selectable,
            mappingsConfigured: false,
            isVerified: false,
            detectionStatus: detection.detectionStatus,
            lastDetectionAt: selectable ? new Date() : null,
            extractedTextItems,
            detectedFields: detection.detectedFields,
            fieldMappings: [],
        },
        createdBy: actor?._id,
    });

    await logLifecycleAudit({
        action: 'Create',
        entityType: 'OfferTemplate',
        entityId: template._id,
        entityName: template.name,
        req,
        actor,
        after: template.toObject(),
    });

    return {
        template,
        hasSelectableText: selectable,
        extractedTextCount: extractedTextItems.length,
        detectedCount: detection.detectedFields.length,
        detectionSummary: detection.detectionSummary,
        verificationFields: buildVerificationFieldList(detection.detectedFields),
        message: !selectable
            ? 'This PDF does not contain selectable text. Automatic field detection is unavailable for this PDF.'
            : `PDF template uploaded. ${detection.detectedFields.length} field(s) detected automatically — please verify and confirm the template.`,
    };
}

function summarizeDetections(detectedFields = []) {
    const summary = { high: 0, medium: 0, low: 0, notDetected: 0 };
    for (const d of detectedFields) {
        if (d.confidenceLevel === 'high') summary.high += 1;
        else if (d.confidenceLevel === 'medium') summary.medium += 1;
        else summary.low += 1;
        if (d.status === 'not_detected') summary.notDetected += 1;
    }
    return summary;
}

export async function getPdfTemplateTextItems(organizationId, templateId) {
    const template = await OfferLetterTemplate.findOne({
        _id: templateId,
        organizationId,
        templateType: 'pdf',
    }).lean();
    if (!template) throw new Error('PDF template not found');
    const detectedFields = template.pdfTemplate?.detectedFields || [];
    return {
        templateId: template._id,
        templateName: template.name,
        hasSelectableText: template.pdfTemplate?.hasSelectableText,
        mappingsConfigured: template.pdfTemplate?.mappingsConfigured === true,
        isVerified: template.pdfTemplate?.isVerified === true,
        detectionStatus: template.pdfTemplate?.detectionStatus || 'pending',
        detectionSummary: summarizeDetections(detectedFields),
        extractedTextItems: template.pdfTemplate?.extractedTextItems || [],
        detectedFields,
        verificationFields: buildVerificationFieldList(detectedFields),
        fieldMappings: template.pdfTemplate?.fieldMappings || [],
        pdfUrl: template.pdfTemplate?.pdfUrl,
        lastDetectionAt: template.pdfTemplate?.lastDetectionAt,
    };
}

export async function savePdfTemplateMappings(organizationId, templateId, mappings, actor, req) {
    await assertFeatureEnabled(organizationId, 'offerLetter', 'Offer letter');
    const template = await OfferLetterTemplate.findOne({
        _id: templateId,
        organizationId,
        templateType: 'pdf',
    });
    if (!template) throw new Error('PDF template not found');
    if (!template.pdfTemplate?.hasSelectableText) {
        throw new Error(
            'This PDF does not contain selectable text. It may be scanned or image-only — '
            + 'field mapping requires a text-based PDF exported from Word or Google Docs.',
        );
    }

    const labelByToken = new Map(OFFER_PLACEHOLDER_DEFINITIONS.map((d) => [d.token, d.label]));
    const extractedItems = template.pdfTemplate.extractedTextItems || [];
    const normalized = (mappings || [])
        .map((m) => normalizeSavedMapping(m, extractedItems, labelByToken))
        .filter(Boolean);

    const configCheck = validatePdfMappingConfig(normalized, extractedItems);
    if (!configCheck.ok) {
        const err = new Error('Invalid PDF field mapping');
        err.code = 'PDF_MAPPING_INVALID';
        err.errors = configCheck.errors;
        throw err;
    }

    template.pdfTemplate.fieldMappings = normalized;
    template.pdfTemplate.mappingsConfigured = true;
    template.pdfTemplate.isVerified = true;
    template.updatedBy = actor?._id;
    await template.save();

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'OfferTemplate',
        entityId: template._id,
        entityName: `${template.name} mappings`,
        req,
        actor,
    });

    return template;
}

export async function previewPdfOfferLetter({
    organizationId,
    candidateId,
    payload = {},
}) {
    await assertFeatureEnabled(organizationId, 'offerLetter', 'Offer letter');

    const candidate = await Candidate.findOne({ _id: candidateId, organizationId });
    if (!candidate) throw new Error('Candidate not found');

    const template = await OfferLetterTemplate.findOne({
        _id: payload.templateId,
        organizationId,
        templateType: 'pdf',
    });
    if (!template) throw new Error('PDF offer template not found');
    assertPdfMappingsConfigured(template);

    const settings = await getOrCreateLifecycleSettings(organizationId);
    const defaultExpiryDays = settings.offerPolicy?.defaultExpiryDays ?? 7;
    const expiryDate = payload.expiryDate
        ? new Date(payload.expiryDate)
        : new Date(Date.now() + defaultExpiryDays * 86400000);

    const offerDraft = {
        position: payload.position || candidate.offerDetails?.position,
        department: payload.department,
        salary: payload.salary ?? candidate.offerDetails?.salary,
        benefits: payload.benefits || candidate.offerDetails?.benefits || [],
        startDate: payload.startDate ? new Date(payload.startDate) : candidate.offerDetails?.startDate,
        expiryDate,
        createdAt: new Date(),
        noticePeriod: payload.noticePeriod,
        probationPeriod: payload.probationPeriod,
        workingHours: payload.workingHours,
        companyName: payload.companyName || payload.company,
    };

    const { placeholderMap } = await resolvePdfOfferContext({
        organizationId,
        candidate,
        template,
        offerDraft,
        payload,
        settings,
    });

    const validation = validatePdfTemplateMappings(template, placeholderMap);
    if (!validation.ok) {
        return {
            templateType: 'pdf',
            templateId: template._id,
            templateName: template.name,
            isValid: false,
            missingFields: validation.missing,
            previewPdfUrl: null,
        };
    }

    const pdf = await generateFilledPdfFile({
        organizationId,
        template,
        placeholderMap,
        fileName: `preview-offer-${candidateId}-${Date.now()}.pdf`,
    });

    // Cache-bust so the browser iframe always loads this fresh preview (not a stale PDF).
    const previewPdfUrl = `${pdf.pdfUrl}?t=${Date.now()}`;

    return {
        templateType: 'pdf',
        templateId: template._id,
        templateName: template.name,
        isValid: true,
        missingFields: [],
        previewPdfUrl,
        // Debug-friendly: confirms which notice value was embedded (not probationNoticeDays)
        resolvedNoticePeriod: placeholderMap['{{noticePeriod}}'] || '',
    };
}

export async function createOfferLetterFromPdfTemplate({
    organizationId,
    candidateId,
    payload,
    actor,
    req,
}) {
    const settings = await assertFeatureEnabled(organizationId, 'offerLetter', 'Offer letter');

    const candidate = await Candidate.findOne({ _id: candidateId, organizationId });
    if (!candidate) throw new Error('Candidate not found');

    const template = await OfferLetterTemplate.findOne({
        _id: payload.templateId,
        organizationId,
        templateType: 'pdf',
    });
    if (!template) throw new Error('PDF offer template not found');
    assertPdfMappingsConfigured(template);

    const defaultExpiryDays = settings.offerPolicy?.defaultExpiryDays ?? 7;
    const expiryDate = payload.expiryDate
        ? new Date(payload.expiryDate)
        : new Date(Date.now() + defaultExpiryDays * 86400000);

    const offerData = {
        organizationId,
        candidateId,
        jobPostingId: candidate.jobPostingId,
        templateId: template._id,
        templateVersion: template.version,
        templateType: 'pdf',
        position: payload.position || candidate.offerDetails?.position,
        department: payload.department,
        salary: payload.salary ?? candidate.offerDetails?.salary,
        benefits: payload.benefits || candidate.offerDetails?.benefits || [],
        startDate: payload.startDate ? new Date(payload.startDate) : candidate.offerDetails?.startDate,
        expiryDate,
        status: 'Draft',
        createdBy: actor?._id,
        bodyHtml: '',
        // Carried on draft for placeholder resolution only (schema may strip unknown fields)
        noticePeriod: payload.noticePeriod,
        probationPeriod: payload.probationPeriod,
    };

    const lastVersion = await OfferLetter.findOne({ organizationId, candidateId }).sort({ version: -1 }).lean();
    offerData.version = (lastVersion?.version || 0) + 1;

    const draft = new OfferLetter(offerData);

    const { placeholderMap } = await resolvePdfOfferContext({
        organizationId,
        candidate,
        template,
        offerDraft: draft,
        payload,
        settings,
    });

    const validation = validatePdfTemplateMappings(template, placeholderMap);
    if (!validation.ok) {
        const err = new Error('Missing offer information required by the PDF template');
        err.code = 'OFFER_PLACEHOLDER_MISSING';
        err.missingFields = validation.missing;
        throw err;
    }

    const pdf = await generateFilledPdfFile({
        organizationId,
        template,
        placeholderMap,
        fileName: `offer-${candidateId}-v${draft.version}.pdf`,
    });

    draft.pdfUrl = pdf.pdfUrl;
    draft.pdfFileName = pdf.pdfFileName;
    draft.activityFeed.push({
        action: 'offer_created',
        description: `Offer letter v${draft.version} created from PDF template`,
        actor: actor?._id,
    });

    await draft.save();

    candidate.offerDetails = {
        ...(candidate.offerDetails?.toObject?.() || candidate.offerDetails || {}),
        position: draft.position,
        startDate: draft.startDate,
        salary: draft.salary,
        benefits: draft.benefits,
        offerLetter: { url: draft.pdfUrl, sentDate: null, expiryDate: draft.expiryDate },
        status: 'Draft',
    };
    await candidate.save();

    await logLifecycleAudit({
        action: 'Create',
        entityType: 'Offer',
        entityId: draft._id,
        entityName: `Offer v${draft.version}`,
        req,
        actor,
        after: draft.toObject(),
    });

    return draft;
}

export async function confirmPdfTemplateFromDetections(organizationId, templateId, mappings, actor, req) {
    return savePdfTemplateMappings(organizationId, templateId, mappings, actor, req);
}

export default {
    listPdfTemplateFieldOptions,
    uploadPdfOfferTemplate,
    getPdfTemplateTextItems,
    detectPdfTemplateFields,
    savePdfTemplateMappings,
    confirmPdfTemplateFromDetections,
    previewPdfOfferLetter,
    createOfferLetterFromPdfTemplate,
    validatePdfTemplateMappings,
};
