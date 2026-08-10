/**
 * PDF mapping geometry — substring positions within extracted text lines.
 * Shared by field detection, save normalization, and mapping safety validation.
 */

/** Approximate glyph width from extracted item metrics (no font file required). */
export function approximateTextWidth(text, fontSize = 11) {
    const t = String(text || '');
    if (!t) return 0;
    return t.length * fontSize * 0.45;
}

/**
 * Build a synthetic line object from extracted items on the same row (for save-time correction).
 */
export function lineFromExtractedItems(extractedItems = [], mapping = {}) {
    const page = mapping.page ?? 0;
    const y = Number(mapping.y) || 0;
    const onRow = extractedItems
        .filter((i) => (i.page ?? 0) === page && Math.abs((i.y || 0) - y) <= 5)
        .sort((a, b) => a.x - b.x);
    if (!onRow.length) return null;
    const text = onRow.map((i) => i.text).join(' ').replace(/\s+/g, ' ').trim();
    return { page, text, items: onRow, x: onRow[0].x, y, width: 0, height: 0 };
}

/**
 * Estimate tight PDF bbox for a substring within a grouped line.
 * Uses proportional character slicing inside each underlying text item.
 */
export function estimateSubstringBBox(line, substring) {
    const trimmed = String(substring || '').trim();
    if (!trimmed || !line?.items?.length) return null;

    const fullText = String(line.text || '');
    const idx = fullText.toLowerCase().indexOf(trimmed.toLowerCase());
    if (idx < 0) {
        const exact = line.items.find(
            (i) => i.text.trim().toLowerCase() === trimmed.toLowerCase(),
        );
        if (!exact) return null;
        return bboxFromSingleItem(exact);
    }

    const endIdx = idx + trimmed.length;
    let charPos = 0;
    let x = null;
    let right = null;
    let y = null;
    let height = null;
    let fontSize = null;

    for (const item of line.items) {
        const itemText = String(item.text || '');
        const itemStart = charPos;
        const itemEnd = charPos + itemText.length;
        charPos = itemEnd + 1;

        const overlapStart = Math.max(itemStart, idx);
        const overlapEnd = Math.min(itemEnd, endIdx);
        if (overlapEnd <= overlapStart) continue;

        const itemLen = Math.max(itemText.length, 1);
        const relStart = overlapStart - itemStart;
        const relEnd = overlapEnd - itemStart;
        const fs = item.fontSize ?? item.height ?? 11;
        const itemWidth = item.width > 0 ? item.width : approximateTextWidth(itemText, fs);
        const sliceStartX = item.x + (relStart / itemLen) * itemWidth;
        const sliceEndX = item.x + (relEnd / itemLen) * itemWidth;

        if (x == null) x = sliceStartX;
        right = sliceEndX;
        y = y == null ? item.y : Math.min(y, item.y);
        const ih = item.height || fs || 11;
        height = Math.max(height || 0, ih);
        fontSize = fontSize ?? fs;
    }

    if (x == null || right == null) return null;

    return {
        page: line.page ?? 0,
        x: Math.round(x * 100) / 100,
        y: Math.round(y * 100) / 100,
        width: Math.max(Math.round((right - x) * 100) / 100, 1),
        height: Math.round((height || fontSize || 11) * 100) / 100,
        fontSize: fontSize ?? 11,
    };
}

function bboxFromSingleItem(item) {
    return {
        page: item.page ?? 0,
        x: Math.round(item.x * 100) / 100,
        y: Math.round(item.y * 100) / 100,
        width: Math.max(Math.round((item.width || approximateTextWidth(item.text, item.fontSize)) * 100) / 100, 1),
        height: Math.round((item.height || item.fontSize || 11) * 100) / 100,
        fontSize: item.fontSize ?? 11,
    };
}

/** Expected max width for a short dynamic value (duration, bare number, date token). */
export function expectedMaxWidthForSource(sourceText, fontSize = 11) {
    const src = String(sourceText || '').trim();
    if (!src) return 0;
    if (/^\d+\s*(days?|months?|weeks?)$/i.test(src)) {
        return approximateTextWidth(src, fontSize) * 1.35;
    }
    if (/^\d+$/.test(src)) {
        return approximateTextWidth(src, fontSize) * 1.35;
    }
    if (/^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}$/.test(src)) {
        return approximateTextWidth(src, fontSize) * 1.35;
    }
    if (/^\d{1,2}(?:st|nd|rd|th)?\s+\w+\s+\d{2,4}$/i.test(src)) {
        return approximateTextWidth(src, fontSize) * 1.35;
    }
    return approximateTextWidth(src, fontSize) * 1.5;
}

const INFLATED_BBOX_RATIO = 2.5;

/**
 * True when saved bbox is far wider than the source token (whole-sentence mistake).
 */
export function isInflatedSourceBbox(mapping, sourceText = mapping?.sourceText) {
    const src = String(sourceText || mapping?.sourceText || '').trim();
    const w = Number(mapping?.width) || 0;
    if (!src || w <= 0) return false;
    const fs = Number(mapping?.fontSize) || 11;
    const expected = expectedMaxWidthForSource(src, fs);
    if (expected <= 0) return false;
    return w > expected * INFLATED_BBOX_RATIO;
}

/**
 * Recompute mapping coordinates from extracted items when source is a substring.
 */
export function correctMappingBboxFromExtracted(mapping, extractedItems = []) {
    const src = String(mapping?.sourceText || '').trim();
    if (!src || !extractedItems.length) return mapping;

    const line = lineFromExtractedItems(extractedItems, mapping);
    if (!line) return mapping;

    const tight = estimateSubstringBBox(line, src);
    if (!tight) return mapping;

    if (!isInflatedSourceBbox({ ...mapping, width: mapping.width }, src)
        && Math.abs(tight.width - (mapping.width || 0)) < 5) {
        return mapping;
    }

    return {
        ...mapping,
        page: tight.page,
        x: tight.x,
        y: tight.y,
        width: tight.width,
        height: tight.height,
        fontSize: tight.fontSize ?? mapping.fontSize,
    };
}

function escapeRegex(text) {
    return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Find a double/single-quoted span in line text that contains inner text. */
export function findQuotedSpanInLine(lineText, innerText) {
    const inner = String(innerText || '').replace(/^["'“”]+|["'“”]+$/g, '').trim();
    if (!inner || !lineText) return null;
    const re = new RegExp(`(["'“”])\\s*${escapeRegex(inner)}\\s*\\1`);
    const m = String(lineText).match(re);
    return m ? m[0] : null;
}

/**
 * Expand prose-field bboxes so covers include quoted titles and full Dear-name slots.
 */
export function expandProseFieldBbox(mapping, extractedItems = []) {
    const token = String(mapping?.placeholderToken || '').replace(/^\{\{|\}\}$/g, '');
    const line = lineFromExtractedItems(extractedItems, mapping);
    if (!line) return mapping;

    const src = String(mapping.sourceText || '').trim();
    if (!src) return mapping;

    if (token === 'position') {
        const quoted = findQuotedSpanInLine(line.text, src)
            || (src.match(/^["'“”]/) ? src : null);
        if (quoted) {
            const tight = estimateSubstringBBox(line, quoted);
            if (tight) {
                return { ...mapping, ...tight, sourceText: quoted };
            }
        }
    }

    if (token === 'candidateName' && /dear\s/i.test(line.text)) {
        const idx = line.text.toLowerCase().indexOf(src.toLowerCase());
        if (idx >= 0) {
            const tight = estimateSubstringBBox(line, src);
            if (tight) {
                const commaItem = line.items.find(
                    (i) => i.x > tight.x + 2 && /^[,，]/.test(String(i.text).trim()),
                );
                if (commaItem) {
                    const width = Math.max(
                        Math.round((commaItem.x - tight.x - 0.5) * 100) / 100,
                        tight.width,
                    );
                    return { ...mapping, ...tight, width };
                }
                return { ...mapping, ...tight };
            }
        }
    }

    return mapping;
}

export default {
    approximateTextWidth,
    lineFromExtractedItems,
    estimateSubstringBBox,
    expectedMaxWidthForSource,
    isInflatedSourceBbox,
    correctMappingBboxFromExtracted,
    findQuotedSpanInLine,
    expandProseFieldBbox,
};
