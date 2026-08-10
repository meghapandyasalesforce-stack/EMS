/**
 * PDF template mapping validation — HR saves exact bounding boxes; no auto-guess at generate time.
 */

import { OFFER_PLACEHOLDER_DEFINITIONS } from './offerPlaceholderResolver.js';
import { assessPdfMappingSafety } from './pdfMappingSafety.js';
import { correctMappingBboxFromExtracted, expandProseFieldBbox, isInflatedSourceBbox } from './pdfMappingGeometry.js';

const LABEL_BY_TOKEN = new Map(
    OFFER_PLACEHOLDER_DEFINITIONS.map((d) => [d.token, d.label]),
);

export const REQUIRED_PDF_MAPPING_TOKENS = Object.freeze([
    'candidateName',
    'position',
]);

/** Tokens that must never be auto-detected or replaced in PDF templates (e.g. company letterhead). */
export const PDF_EXCLUDED_MAPPING_TOKENS = Object.freeze([
    'email',
    'candidateEmail',
]);

export function isPdfExcludedMappingToken(token) {
    const bare = String(token || '').replace(/^\{\{|\}\}$/g, '');
    return PDF_EXCLUDED_MAPPING_TOKENS.includes(bare);
}

export function stripExcludedPdfMappings(mappings = []) {
    return (mappings || []).filter((m) => !isPdfExcludedMappingToken(m.placeholderToken));
}

export function buildItemKey(item) {
    if (!item) return '';
    return `${item.page}|${item.x}|${item.y}|${item.text}`;
}

export const buildItemRef = buildItemKey;

export function findExtractedItemByKey(items = [], itemKey) {
    if (!itemKey) return null;
    const parts = String(itemKey).split('|');
    if (parts.length < 4) return null;
    const page = Number(parts[0]);
    const x = Number(parts[1]);
    const y = Number(parts[2]);
    const text = parts.slice(3).join('|');
    return items.find((i) => (
        i.page === page
        && Math.abs(i.x - x) < 1
        && Math.abs(i.y - y) < 1
        && i.text === text
    )) || null;
}

export const findExtractedItemByRef = findExtractedItemByKey;

export function normalizeSavedMapping(raw, extractedItems = [], labelByToken = LABEL_BY_TOKEN) {
    const token = String(raw.placeholderToken || '').replace(/^\{\{|\}\}$/g, '');
    if (!token || isPdfExcludedMappingToken(token)) return null;

    const explicitSource = String(raw.sourceText || raw.searchText || '').trim();
    let item = null;
    if (raw.itemKey || raw.itemRef) {
        item = findExtractedItemByKey(extractedItems, raw.itemKey || raw.itemRef);
    }

    let sourceText = explicitSource || String(item?.text || '').trim();
    if (explicitSource && item?.text && item.text.includes(explicitSource) && item.text !== explicitSource) {
        sourceText = explicitSource;
    }
    if (!sourceText) return null;

    if (!item && raw.page != null && raw.x != null && raw.y != null) {
        item = extractedItems.find((i) => (
            i.page === raw.page
            && Math.abs(i.x - raw.x) < 1
            && Math.abs(i.y - raw.y) < 1
            && i.text === sourceText
        )) || null;
    }
    if (!item) {
        item = extractedItems.find((i) => i.text === sourceText && (raw.page == null || i.page === raw.page)) || null;
    }

    const hasExplicitCoords = raw.page != null && raw.x != null && raw.y != null && (raw.width > 0);
    const preferRawGeometry = hasExplicitCoords && (
        !item
        || (explicitSource && item.text !== explicitSource)
    );
    const coords = preferRawGeometry ? raw : (item || raw);

    let normalized = {
        placeholderToken: token,
        label: raw.label || labelByToken.get(token) || token,
        sourceText,
        itemKey: item ? buildItemKey(item) : (raw.itemKey || buildItemKey({
            page: coords.page ?? 0,
            x: coords.x ?? 0,
            y: coords.y ?? 0,
            text: sourceText,
        })),
        page: coords.page ?? 0,
        x: coords.x ?? 0,
        y: coords.y ?? 0,
        width: coords.width ?? 0,
        height: coords.height ?? 0,
        fontSize: coords.fontSize ?? 11,
        confidence: raw.confidence ?? 0,
        confidenceLevel: raw.confidenceLevel || 'low',
        replacementStrategy: raw.replacementStrategy || 'overlay',
        required: raw.required !== false,
        detectedLabel: raw.detectedLabel || '',
    };

    // Tighten substring bboxes (e.g. "60 days" inside a full sentence item)
    normalized = correctMappingBboxFromExtracted(normalized, extractedItems);
    normalized = expandProseFieldBbox(normalized, extractedItems);

    if (isInflatedSourceBbox(normalized, sourceText)) {
        return null;
    }

    // Drop incoherent bindings at save time (e.g. candidateName → salary cell)
    if (assessPdfMappingSafety(normalized, extractedItems).incoherent) {
        return null;
    }

    return normalized;
}

export function validatePdfMappingConfig(mappings = [], extractedItems = []) {
    const errors = [];
    if (!mappings.length) {
        errors.push({ message: 'At least one field mapping is required.' });
        return { ok: false, errors };
    }

    const requiredSeen = new Set();
    const coordKeys = new Set();
    for (const mapping of mappings) {
        const label = mapping.label || LABEL_BY_TOKEN.get(mapping.placeholderToken) || mapping.placeholderToken;
        if (!mapping.sourceText) {
            errors.push({ token: mapping.placeholderToken, label, message: `${label} has no PDF text region selected` });
        }
        if (!(mapping.width > 0) || !(mapping.height > 0)) {
            errors.push({ token: mapping.placeholderToken, label, message: `${label} is missing a valid bounding box` });
        }
        const safety = assessPdfMappingSafety(mapping, extractedItems);
        if (safety.incoherent) {
            errors.push({
                token: mapping.placeholderToken,
                label,
                message: `${label} mapping is invalid: ${safety.reason}`,
            });
        }
        if (isInflatedSourceBbox(mapping, mapping.sourceText)) {
            errors.push({
                token: mapping.placeholderToken,
                label,
                message: `${label} bounding box is too wide for source text "${mapping.sourceText}"`,
            });
        }
        // Allow same token at different coordinates (e.g. Gross Salary in two annexure sections)
        const coordKey = `${mapping.placeholderToken}|${mapping.page}|${Math.round(mapping.x)}|${Math.round(mapping.y)}`;
        if (coordKeys.has(coordKey)) {
            errors.push({ token: mapping.placeholderToken, label, message: `Duplicate mapping at the same position for ${label}` });
        }
        coordKeys.add(coordKey);
        requiredSeen.add(mapping.placeholderToken);
    }

    for (const required of REQUIRED_PDF_MAPPING_TOKENS) {
        if (!requiredSeen.has(required)) {
            errors.push({
                token: required,
                label: LABEL_BY_TOKEN.get(required) || required,
                message: `${LABEL_BY_TOKEN.get(required) || required} must be mapped`,
            });
        }
    }

    return { ok: errors.length === 0, errors };
}

export const validateMappingDefinitions = validatePdfMappingConfig;

export function validatePdfMappingsAgainstPlaceholders(mappings = [], placeholderMap = {}) {
    const missing = [];
    const seen = new Set();

    for (const mapping of mappings) {
        if (mapping.required === false) continue;
        const token = String(mapping.placeholderToken || '').replace(/^\{\{|\}\}$/g, '');
        const key = `{{${token}}}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const value = placeholderMap[key];
        if (value == null || String(value).trim() === '') {
            missing.push({
                token: key,
                label: mapping.label || LABEL_BY_TOKEN.get(token) || token,
            });
        }
    }

    return { ok: missing.length === 0, missing };
}

export function validatePdfTemplateMappings(template, placeholderMap) {
    return validatePdfMappingsAgainstPlaceholders(
        template.pdfTemplate?.fieldMappings || [],
        placeholderMap,
    );
}

export default {
    REQUIRED_PDF_MAPPING_TOKENS,
    PDF_EXCLUDED_MAPPING_TOKENS,
    isPdfExcludedMappingToken,
    stripExcludedPdfMappings,
    buildItemKey,
    buildItemRef,
    findExtractedItemByKey,
    findExtractedItemByRef,
    normalizeSavedMapping,
    validatePdfMappingConfig,
    validateMappingDefinitions,
    validatePdfMappingsAgainstPlaceholders,
    validatePdfTemplateMappings,
};
