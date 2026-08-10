/**
 * Extract selectable text items with positions from a PDF buffer (pdf.js).
 */

let pdfjsModule = null;

async function getPdfJs() {
    if (!pdfjsModule) {
        pdfjsModule = await import('pdfjs-dist/legacy/build/pdf.mjs');
    }
    return pdfjsModule;
}

export async function extractPdfTextItems(buffer) {
    const pdfjs = await getPdfJs();
    const data = Buffer.isBuffer(buffer)
        ? new Uint8Array(buffer)
        : (buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer));
    const loadingTask = pdfjs.getDocument({ data, useSystemFonts: true, disableFontFace: true });
    const pdf = await loadingTask.promise;
    const items = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        for (const item of textContent.items) {
            const str = String(item.str || '').trim();
            if (!str) continue;
            const transform = item.transform || [1, 0, 0, 1, 0, 0];
            const fontSize = Math.max(8, Math.hypot(transform[2], transform[3]) || 11);
            const x = transform[4];
            const y = transform[5];
            const width = item.width || str.length * fontSize * 0.45;
            items.push({
                text: str,
                page: pageNum - 1,
                x: Math.round(x * 100) / 100,
                y: Math.round(y * 100) / 100,
                width: Math.round(width * 100) / 100,
                height: Math.round(fontSize * 100) / 100,
                fontSize: Math.round(fontSize * 100) / 100,
            });
        }
        page.cleanup();
    }

    await pdf.destroy();
    return items;
}

export function hasSelectableText(items = []) {
    return items.some((item) => item.text && item.text.length >= 2);
}

/** Deduplicate by text for mapping dropdown; keep first occurrence position. */
export function uniqueTextItemsForMapping(items = []) {
    const seen = new Map();
    for (const item of items) {
        const key = item.text.trim();
        if (!key || key.length < 2) continue;
        if (!seen.has(key)) seen.set(key, item);
    }
    return [...seen.values()].sort((a, b) => a.page - b.page || a.y - b.y);
}

export default { extractPdfTextItems, hasSelectableText, uniqueTextItemsForMapping };
