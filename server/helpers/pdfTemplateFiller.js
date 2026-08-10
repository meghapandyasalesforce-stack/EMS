/**
 * Fill HR-mapped PDF fields using exact saved VALUE bounding boxes.
 *
 * Rules:
 * - Cover ONLY the original mapped value (never the surrounding sentence/label).
 * - Prefer shrinking the replacement font into the original slot over expanding the cover.
 * - Adapt replacement shape to the source (e.g. source "60" + value "90 days" → draw "90").
 * - Skip incoherent mappings (e.g. candidateName in salary table) instead of corrupting the PDF.
 * - Prose layout uses neighboring extracted PDF text (Dear/comma, quotes, per annum)
 *   so spacing stays natural — not blind left/right alignment to mapping.width.
 */

import fs from 'fs';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import {
    samplePdfBackgroundColors,
    sanitizeSampledBackground,
} from './pdfBackgroundSampler.js';
import {
    assessPdfMappingSafety,
    filterSafePdfMappings,
    isIncoherentPdfMapping,
    SALARY_LIKE_TOKENS,
} from './pdfMappingSafety.js';
import logger from './logger.js';

const MIN_FONT_SIZE = 6;
/** Only expand past the original value width when the fitted min-size text still overflows. */
const MAX_WIDTH_EXPANSION = 1.15;
const COVER_PAD_X = 0.4;
/** Below baseline — erase descenders (g/y/j/p) without eating the next line. */
const DESCENDER_RATIO = 0.2;
/** Above baseline — erase ascenders without eating the line above. */
const ASCENDER_RATIO = 0.75;
/**
 * Safety rail only: if a saved bbox is absurdly larger than the source glyphs
 * (whole-sentence mistake), clamp so we do not wipe surrounding prose.
 */
const INFLATED_BBOX_RATIO = 2.5;

/** Prose letter fields — Times closer to typical offer-letter PDFs than Helvetica. */
const SERIF_PROSE_TOKENS = new Set([
    'candidateName', 'position', 'department', 'reportingManager', 'location',
    'companyName', 'employmentType', 'startDate', 'offerDate', 'offerExpiryDate',
    'noticePeriod', 'probationPeriod', 'workingHours', 'leaveEntitlement', 'salaryWords',
]);

const NEIGHBOR_PROSE_TOKENS = new Set([
    'candidateName', 'position', 'salaryWords',
]);

function tokenKey(placeholderToken) {
    const bare = String(placeholderToken || '').replace(/^\{\{|\}\}$/g, '');
    return `{{${bare}}}`;
}

/**
 * Shape the resolved value to match what was actually mapped in the PDF,
 * so surrounding static words (e.g. "days") are not overwritten.
 */
export function adaptReplacementToSource(sourceText, value) {
    let src = String(sourceText || '').trim();
    let val = String(value || '').trim();
    if (!val) return '';

    const srcQuote = src.match(/^(["'“”])(.+)\1$/) || src.match(/^(["'“”])(.+)$/);
    const hadQuotes = !!srcQuote;
    const quoteOpen = srcQuote?.[1] || '';
    const quoteClose = quoteOpen === '“' ? '”' : quoteOpen;

    src = src.replace(/^["'“”]+|["'“”]+$/g, '').trim();
    val = val.replace(/^["'“”]+|["'“”]+$/g, '').trim();

    // Bare number mapped → keep only the numeric token (preserves static "days")
    if (/^\d+$/.test(src)) {
        const num = val.match(/\d[\d,]*/);
        return num ? num[0] : val;
    }

    // Source is "60 days" / "3 months" → keep the unit form from source
    if (/^\d+\s*(days?|months?|weeks?)$/i.test(src)) {
        const srcUnit = (src.match(/(days?|months?|weeks?)/i) || ['days'])[0];
        const m = val.match(/^(\d+)\s*(days?|months?|weeks?)?$/i)
            || val.match(/(\d+)\s*(days?|months?|weeks?)/i);
        if (m) return `${m[1]} ${srcUnit}`;
    }

    // Salary-style: source had no Rs/INR prefix → strip it from the value
    if (src && !/^(?:rs\.?\s*|inr\s*)/i.test(src) && /^(?:Rs\.?\s*|INR\s*)/i.test(val)) {
        val = val.replace(/^(?:Rs\.?\s*|INR\s*)/i, '').trim();
    }

    if (hadQuotes && quoteOpen) {
        return `${quoteOpen}${val}${quoteClose || quoteOpen}`;
    }

    return val;
}

export { isIncoherentPdfMapping };

function resolveMappingValue(mapping, placeholderMap = {}) {
    const key = tokenKey(mapping.placeholderToken);
    const raw = String(placeholderMap[key] ?? '').trim();
    if (!raw) return '';
    const source = String(mapping.sourceText || mapping.searchText || '').trim();
    return adaptReplacementToSource(source, raw);
}

function fitFontSize(font, text, maxWidth, baseSize) {
    let size = baseSize || 11;
    const floor = MIN_FONT_SIZE;
    while (size > floor) {
        if (font.widthOfTextAtSize(text, size) <= maxWidth) return size;
        size -= 0.5;
    }
    return floor;
}

/**
 * Source-of-truth slot width = saved mapping.width from PDF extraction.
 */
function effectiveSourceWidth(mapping, font, fontSize) {
    const mappedWidth = Math.max(Number(mapping.width) || 0, 0);
    const source = String(mapping.sourceText || mapping.searchText || '').trim()
        .replace(/^["'“”]+|["'“”]+$/g, '');

    let measured = 0;
    if (source && font && fontSize) {
        measured = font.widthOfTextAtSize(source, fontSize);
    }

    if (mappedWidth > 0) {
        if (measured > 0 && mappedWidth > measured * INFLATED_BBOX_RATIO) {
            return measured * 1.1;
        }
        return mappedWidth;
    }

    return Math.max(measured, 8);
}

function mappingTokenBare(mapping) {
    return String(mapping?.placeholderToken || '').replace(/^\{\{|\}\}$/g, '');
}

function rowItemsForMapping(mapping, extractedTextItems = []) {
    const page = mapping.page ?? 0;
    const y = Number(mapping.y) || 0;
    return (extractedTextItems || [])
        .filter((i) => (i.page ?? 0) === page && Math.abs((i.y || 0) - y) <= 5)
        .sort((a, b) => a.x - b.x);
}

/**
 * Proportional end-x of a prefix inside a single extracted PDF text item.
 */
function prefixEndX(item, prefix) {
    const text = String(item?.text || '');
    const pre = String(prefix || '');
    if (!text || !pre || !text.toLowerCase().startsWith(pre.toLowerCase())) {
        return Number(item?.x) || 0;
    }
    const w = Number(item.width) || 0;
    return (Number(item.x) || 0) + (pre.length / Math.max(text.length, 1)) * w;
}

/**
 * Neighbor-aware prose layout using extracted PDF text around the mapping.
 * Positions replacements from real neighbor coordinates — not blind align-to-width.
 */
export function resolveProseDrawPlan(mapping, value, font, baseFontSize, extractedTextItems = [], fonts = null) {
    const token = mappingTokenBare(mapping);
    const row = rowItemsForMapping(mapping, extractedTextItems);
    const mapX = Number(mapping.x) || 0;
    const mapW = Math.max(Number(mapping.width) || 0, 0);
    const mapEnd = mapX + mapW;
    const glyphHeight = Math.max(Number(mapping.height) || 0, baseFontSize);

    let drawValue = String(value || '');
    let coverX = mapX;
    let coverW = mapW;
    let drawX = mapX;
    let maxContentW = mapW;
    /** Extra left cover pad to erase residual glyph stems without using mapping.width for spacing. */
    let coverPadLeft = COVER_PAD_X;
    /** When set, fill redraws this prefix (Bold Dear) after covering the whole Dear run. */
    let prefixText = '';
    let prefixFont = null;
    let prefixX = null;
    let salaryFoldedTrail = false;

    if (token === 'candidateName') {
        // One PDF run is "Dear Rohan Sharma,". Partial covers leave glyph stems ("|").
        // Cover the entire run; redraw Bold "Dear " + name+comma so no original ink remains.
        const dearItem = row.find((i) => /^dear\b/i.test(String(i.text || '').trim()));
        if (dearItem) {
            const itemEnd = dearItem.x + (dearItem.width || 0);
            const dearPrefix = (String(dearItem.text).match(/^(Dear\s+)/i) || ['Dear ', 'Dear '])[1];
            const boldFont = fonts?.timesBold || font;
            prefixText = dearPrefix;
            prefixFont = boldFont;
            prefixX = dearItem.x;
            const prefixW = boldFont.widthOfTextAtSize(dearPrefix, baseFontSize);
            drawX = dearItem.x + prefixW;
            coverX = dearItem.x;
            coverW = Math.max(mapW, dearItem.width || 0, itemEnd - coverX);
            coverPadLeft = 0.8;
            const nameOnly = drawValue.replace(/^Dear\s+/i, '').replace(/,?\s*$/, '').trim();
            drawValue = /,\s*$/.test(dearItem.text) ? `${nameOnly},` : nameOnly;
            maxContentW = Math.max(8, itemEnd - drawX);
        } else {
            drawX = mapX;
            coverX = mapX;
            coverW = mapW;
            maxContentW = mapW;
        }
    } else if (token === 'position') {
        // Quoted title is its own item. Preserve opening/closing quotes on the drawn value;
        // cover the full quote span so no original title/quotes remain.
        const quoteItem = row.find((i) => {
            const t = String(i.text || '').trim();
            return /^["“]/.test(t) && /["”]$/.test(t);
        }) || row.find((i) => Math.abs((i.x || 0) - mapX) < 1.5);
        const qX = quoteItem ? Number(quoteItem.x) || mapX : mapX;
        const qW = quoteItem ? Math.max(Number(quoteItem.width) || 0, mapW) : mapW;
        coverX = qX;
        coverW = qW;
        drawX = qX;
        maxContentW = qW;
        coverPadLeft = 0.8;
    } else if (token === 'salaryWords') {
        // Keep static "CTC of ". Left-anchor at mapping.x.
        // Short values cannot both hug "CTC of" and abut fixed "per annum" at its native x —
        // that caused Onlyper / huge voids. When the trailing void would be large, cover the
        // neighbor "per annum…" item and re-ink it immediately after salaryWords (same words,
        // one space). When the value nearly fills the slot, leave static "per annum" untouched.
        const perAnnum = row.find((i) => /^per\s+annum/i.test(String(i.text || '').trim()));
        coverX = mapX;
        drawX = mapX;
        if (perAnnum) {
            const spaceW = Math.max(font.widthOfTextAtSize(' ', baseFontSize), 2.75);
            const rightLimit = perAnnum.x - spaceW;
            const baseValue = drawValue;
            const probeW = font.widthOfTextAtSize(baseValue, baseFontSize);
            const trailingVoid = rightLimit - (mapX + probeW);
            if (trailingVoid > 24) {
                const trail = String(perAnnum.text || '').trim();
                if (trail && !/^per\s+annum/i.test(baseValue)) {
                    drawValue = `${baseValue.replace(/\s+$/, '')} ${trail}`;
                    salaryFoldedTrail = true;
                }
                const trailEnd = perAnnum.x + (perAnnum.width || 0);
                coverW = Math.max(mapW, trailEnd - mapX);
                maxContentW = Math.max(8, coverW);
            } else {
                coverW = Math.max(1, Math.min(mapEnd, perAnnum.x - 1.25) - mapX);
                maxContentW = Math.max(8, rightLimit - mapX);
            }
            coverPadLeft = 0.8;
        } else {
            coverW = mapW;
            maxContentW = mapW;
        }
    }

    let fontSize = fitFontSize(font, drawValue, maxContentW, baseFontSize);
    let textWidth = font.widthOfTextAtSize(drawValue, fontSize);

    if (textWidth > maxContentW) {
        const expanded = Math.min(textWidth, maxContentW * MAX_WIDTH_EXPANSION);
        fontSize = fitFontSize(font, drawValue, expanded, baseFontSize);
        textWidth = font.widthOfTextAtSize(drawValue, fontSize);
        // salaryWords must not expand into "per annum"
        if (token !== 'salaryWords') {
            coverW = Math.max(coverW, textWidth);
        }
    }

    // Ensure cover erases the full original dynamic span (not only the shorter replacement).
    if (token === 'candidateName' || token === 'position') {
        coverW = Math.max(coverW, mapW, textWidth, (drawX + textWidth) - coverX);
    } else if (token === 'salaryWords') {
        coverW = Math.max(coverW, mapW, (drawX + textWidth) - coverX);
        const perAnnum = row.find((i) => /^per\s+annum/i.test(String(i.text || '').trim()));
        if (perAnnum && !salaryFoldedTrail) {
            coverW = Math.min(coverW, Math.max(1, perAnnum.x - coverX - 1.25));
            const spaceW = Math.max(font.widthOfTextAtSize(' ', fontSize), 2.75);
            const hardLimit = perAnnum.x - spaceW - drawX;
            if (textWidth > hardLimit && hardLimit > 8) {
                fontSize = fitFontSize(font, drawValue, hardLimit, fontSize);
                textWidth = font.widthOfTextAtSize(drawValue, fontSize);
            }
        }
    }

    const coverHeight = Math.min(
        glyphHeight * (ASCENDER_RATIO + DESCENDER_RATIO) + 0.3,
        glyphHeight * 1.1,
    );
    const coverY = Math.max(0, mapping.y - glyphHeight * DESCENDER_RATIO);

    return {
        value: drawValue,
        coverX: Math.max(0, coverX - coverPadLeft),
        coverY,
        coverWidth: coverW + coverPadLeft + COVER_PAD_X,
        coverHeight,
        drawX,
        drawY: mapping.y,
        fontSize,
        sourceWidth: mapW,
        textWidth,
        prefixText,
        prefixFont,
        prefixX,
    };
}

/**
 * Generic (non-prose / table) bounding box from saved mapping.
 */
function boundingBoxForMapping(mapping, text, font, baseFontSize, slotWidthOverride) {
    const sourceWidth = slotWidthOverride ?? effectiveSourceWidth(mapping, font, baseFontSize);
    const mappedHeight = Math.max(Number(mapping.height) || 0, 0);
    const glyphHeight = mappedHeight > 0 ? mappedHeight : baseFontSize;

    let fontSize = fitFontSize(font, text, sourceWidth, baseFontSize);
    let textWidth = font.widthOfTextAtSize(String(text || ''), fontSize);

    let contentWidth = sourceWidth;
    if (textWidth > sourceWidth) {
        const expanded = Math.min(textWidth, sourceWidth * MAX_WIDTH_EXPANSION);
        contentWidth = Math.max(sourceWidth, expanded);
        fontSize = fitFontSize(font, text, contentWidth, baseFontSize);
        textWidth = font.widthOfTextAtSize(String(text || ''), fontSize);
        if (textWidth > contentWidth) {
            fontSize = fitFontSize(font, text, contentWidth, fontSize);
            textWidth = font.widthOfTextAtSize(String(text || ''), fontSize);
        }
    }

    const coverContentW = textWidth <= sourceWidth
        ? sourceWidth
        : Math.min(contentWidth, sourceWidth * MAX_WIDTH_EXPANSION);

    const coverHeight = Math.min(
        glyphHeight * (ASCENDER_RATIO + DESCENDER_RATIO) + 0.3,
        glyphHeight * 1.1,
    );
    const coverY = Math.max(0, mapping.y - glyphHeight * DESCENDER_RATIO);

    return {
        coverX: Math.max(0, mapping.x - COVER_PAD_X),
        coverY,
        coverWidth: coverContentW + COVER_PAD_X * 2,
        coverHeight,
        drawX: mapping.x,
        drawY: mapping.y,
        fontSize,
        sourceWidth,
        textWidth,
    };
}

function pickReplacementFont(token, fonts) {
    if (SALARY_LIKE_TOKENS.has(token) && token !== 'salaryWords') {
        return fonts.helvetica;
    }
    if (SERIF_PROSE_TOKENS.has(token)) {
        return fonts.times;
    }
    return fonts.helvetica;
}

function mappingColorKey(mapping) {
    return `${mapping.page}|${Math.round(mapping.x)}|${Math.round(mapping.y)}`;
}

function resolveCoverColor(bgColors, mapping) {
    const token = mappingTokenBare(mapping);
    // Offer-letter prose sits on white paper — sampling often picks up anti-aliased gray ink.
    if (!SALARY_LIKE_TOKENS.has(token) || token === 'salaryWords') {
        return { r: 1, g: 1, b: 1 };
    }
    const sampled = bgColors.get(mappingColorKey(mapping));
    return sanitizeSampledBackground(sampled || { r: 1, g: 1, b: 1 });
}

export async function fillPdfTemplateMappings({
    templatePdfBytes,
    mappings = [],
    placeholderMap = {},
    extractedTextItems = [],
}) {
    const pdfDoc = await PDFDocument.load(templatePdfBytes, { ignoreEncryption: true });
    const fonts = {
        helvetica: await pdfDoc.embedFont(StandardFonts.Helvetica),
        times: await pdfDoc.embedFont(StandardFonts.TimesRoman),
        timesBold: await pdfDoc.embedFont(StandardFonts.TimesRomanBold),
    };
    const pages = pdfDoc.getPages();

    const seen = new Set();
    const activePlans = [];

    const safeMappings = filterSafePdfMappings(mappings, extractedTextItems, {
        onSkip: (mapping, reason) => {
            logger.warn('Skipping incoherent PDF field mapping during fill', {
                token: mapping.placeholderToken,
                sourceText: mapping.sourceText,
                page: mapping.page,
                x: mapping.x,
                y: mapping.y,
                reason,
            });
        },
    });

    for (const mapping of safeMappings) {
        const dedupeKey = `${mapping.page}|${Math.round(mapping.x * 100)}|${Math.round(mapping.y * 100)}|${mapping.placeholderToken}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        const assessment = assessPdfMappingSafety(mapping, extractedTextItems);
        if (assessment.incoherent) {
            logger.warn('Skipping incoherent PDF field mapping during fill', {
                token: mapping.placeholderToken,
                sourceText: mapping.sourceText,
                page: mapping.page,
                x: mapping.x,
                y: mapping.y,
                reason: assessment.reason,
            });
            continue;
        }

        const sourceText = String(mapping.sourceText || mapping.searchText || '').trim();
        const value = resolveMappingValue(mapping, placeholderMap);
        if (!value) continue;

        const sourceNorm = adaptReplacementToSource(sourceText, sourceText);
        if (sourceText && (value === sourceText || value === sourceNorm)) continue;

        const token = mappingTokenBare(mapping);
        const baseFontSize = Math.max(MIN_FONT_SIZE, Number(mapping.fontSize) || 11);
        const renderFont = pickReplacementFont(token, fonts);

        const plan = NEIGHBOR_PROSE_TOKENS.has(token)
            ? resolveProseDrawPlan(mapping, value, renderFont, baseFontSize, extractedTextItems, fonts)
            : boundingBoxForMapping(mapping, value, renderFont, baseFontSize);

        activePlans.push({
            mapping,
            value: plan.value || value,
            font: renderFont,
            coverX: plan.coverX,
            coverY: plan.coverY,
            coverWidth: plan.coverWidth,
            coverHeight: plan.coverHeight,
            drawX: plan.drawX,
            drawY: plan.drawY,
            fontSize: plan.fontSize,
            sourceWidth: plan.sourceWidth,
            textWidth: plan.textWidth,
            prefixText: plan.prefixText || '',
            prefixFont: plan.prefixFont || null,
            prefixX: plan.prefixX,
        });
    }

    const bgSamplePlans = activePlans.filter(
        (p) => SALARY_LIKE_TOKENS.has(mappingTokenBare(p.mapping))
            && mappingTokenBare(p.mapping) !== 'salaryWords',
    );
    const bgColors = bgSamplePlans.length
        ? await samplePdfBackgroundColors(
            templatePdfBytes,
            bgSamplePlans.map((p) => p.mapping),
            bgSamplePlans.map((p) => ({
                mapping: p.mapping,
                coverX: p.coverX,
                coverY: p.coverY,
                coverWidth: Math.min(p.coverWidth, p.sourceWidth + COVER_PAD_X * 2),
                coverHeight: p.coverHeight,
            })),
        )
        : new Map();

    const sorted = [...activePlans].sort((a, b) => {
        if (a.mapping.page !== b.mapping.page) return a.mapping.page - b.mapping.page;
        return a.mapping.y - b.mapping.y;
    });

    for (const plan of sorted) {
        const page = pages[plan.mapping.page];
        if (!page) continue;

        const bg = resolveCoverColor(bgColors, plan.mapping);

        page.drawRectangle({
            x: plan.coverX,
            y: plan.coverY,
            width: plan.coverWidth,
            height: plan.coverHeight,
            color: rgb(bg.r, bg.g, bg.b),
            borderWidth: 0,
            opacity: 1,
        });

        if (plan.prefixText && plan.prefixFont) {
            page.drawText(plan.prefixText, {
                x: plan.prefixX ?? plan.coverX,
                y: plan.drawY,
                size: plan.fontSize,
                font: plan.prefixFont,
                color: rgb(0, 0, 0),
            });
        }

        page.drawText(plan.value, {
            x: plan.drawX,
            y: plan.drawY,
            size: plan.fontSize,
            font: plan.font,
            color: rgb(0, 0, 0),
        });
    }

    return Buffer.from(await pdfDoc.save());
}

export { boundingBoxForMapping };

export async function fillPdfTemplateFromFile({
    templatePath,
    mappings,
    placeholderMap,
    outputPath,
    extractedTextItems,
}) {
    const bytes = fs.readFileSync(templatePath);
    const filled = await fillPdfTemplateMappings({
        templatePdfBytes: bytes,
        mappings,
        placeholderMap,
        extractedTextItems,
    });
    fs.writeFileSync(outputPath, filled);
    return filled;
}

export default {
    fillPdfTemplateMappings,
    fillPdfTemplateFromFile,
    adaptReplacementToSource,
    isIncoherentPdfMapping,
    boundingBoxForMapping,
    resolveProseDrawPlan,
};
