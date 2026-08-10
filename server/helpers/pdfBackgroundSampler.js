/**
 * Sample background colors from PDF pages so text overlays match template styling.
 * Samples OUTSIDE glyph ink (left / above the value). Preserves light table-row
 * tints so covers do not appear as bright white "pasted paper" patches.
 */

let pdfjsModule = null;

async function getPdfJs() {
    if (!pdfjsModule) {
        pdfjsModule = await import('pdfjs-dist/legacy/build/pdf.mjs');
    }
    return pdfjsModule;
}

function mappingColorKey(mapping) {
    return `${mapping.page}|${Math.round(mapping.x)}|${Math.round(mapping.y)}`;
}

/** Pixels darker than this are treated as text ink, not background. */
const TEXT_LUMINANCE_MAX = 215;

/**
 * Average only light (background) pixels. If none, fall back to pure white.
 */
export function averageRgbFromImageData(data) {
    let lightR = 0;
    let lightG = 0;
    let lightB = 0;
    let lightCount = 0;

    for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3];
        if (alpha < 10) continue;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        if (luminance < TEXT_LUMINANCE_MAX) continue;
        lightR += r;
        lightG += g;
        lightB += b;
        lightCount += 1;
    }

    if (!lightCount) return { r: 1, g: 1, b: 1 };

    return sanitizeSampledBackground({
        r: lightR / lightCount / 255,
        g: lightG / lightCount / 255,
        b: lightB / lightCount / 255,
    });
}

function luminanceOf(bg) {
    if (!bg) return 1;
    return 0.299 * bg.r + 0.587 * bg.g + 0.114 * bg.b;
}

/**
 * Clean sampled backgrounds:
 * - Preserve light gray / tinted table cells (so covers blend in)
 * - Snap only dirty mid-gray (ink contamination) to white
 * - Keep near-white page backgrounds as pure white
 */
export function sanitizeSampledBackground(bg) {
    if (!bg) return { r: 1, g: 1, b: 1 };

    const { r, g, b } = bg;
    const lum = luminanceOf(bg);
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);

    // Essentially white page → pure white
    if (chroma < 0.04 && lum >= 0.97) {
        return { r: 1, g: 1, b: 1 };
    }

    // Dirty mid-gray from residual anti-aliased ink → treat as white page
    if (chroma < 0.05 && lum < 0.88) {
        return { r: 1, g: 1, b: 1 };
    }

    // Light gray table rows / soft tints / colored cells → keep as sampled
    return { r, g, b };
}

/**
 * Prefer soft table-row tints over pure white when both were sampled
 * (left strip may hit page margin white while the cell is gray).
 * Ignore strongly chromatic header greens when a neutral sample exists.
 */
export function pickBestBackgroundSample(samples = []) {
    if (!samples.length) return { r: 1, g: 1, b: 1 };

    const cleaned = samples.map((s) => sanitizeSampledBackground(s));
    const neutral = cleaned.filter((s) => {
        const chroma = Math.max(s.r, s.g, s.b) - Math.min(s.r, s.g, s.b);
        return chroma < 0.08;
    });
    const pool = neutral.length ? neutral : cleaned;
    const tinted = pool.filter((s) => {
        const lum = luminanceOf(s);
        const chroma = Math.max(s.r, s.g, s.b) - Math.min(s.r, s.g, s.b);
        return lum < 0.97 || chroma >= 0.04;
    });
    const use = tinted.length ? tinted : pool;
    const avg = use.reduce(
        (acc, s) => ({ r: acc.r + s.r, g: acc.g + s.g, b: acc.b + s.b }),
        { r: 0, g: 0, b: 0 },
    );
    return sanitizeSampledBackground({
        r: avg.r / use.length,
        g: avg.g / use.length,
        b: avg.b / use.length,
    });
}

function readSample(ctx, canvas, viewport, pdfX, pdfY, pdfW, pdfH, scale) {
    const px = Math.max(0, Math.round(pdfX * scale));
    const py = Math.max(0, Math.round(viewport.height - (pdfY + pdfH) * scale));
    const pw = Math.min(Math.ceil(pdfW * scale), canvas.width - px);
    const ph = Math.min(Math.ceil(pdfH * scale), canvas.height - py);
    if (pw <= 0 || ph <= 0) return null;
    try {
        return averageRgbFromImageData(ctx.getImageData(px, py, pw, ph).data);
    } catch {
        return null;
    }
}

/**
 * @param {Buffer|Uint8Array} pdfBytes
 * @param {Array} mappings
 * @param {Array} drawPlans - optional { mapping, coverX, coverY, coverWidth, coverHeight }
 */
export async function samplePdfBackgroundColors(pdfBytes, mappings = [], drawPlans = []) {
    const plans = drawPlans.length
        ? drawPlans
        : mappings.map((mapping) => ({
            mapping,
            coverX: mapping.x,
            coverY: mapping.y - 3,
            coverWidth: mapping.width || 80,
            coverHeight: (mapping.height || 11) + 6,
        }));

    if (!plans.length) return new Map();

    let createCanvas;
    try {
        ({ createCanvas } = await import('@napi-rs/canvas'));
    } catch {
        return new Map();
    }

    const pdfjs = await getPdfJs();
    const data = Buffer.isBuffer(pdfBytes) ? new Uint8Array(pdfBytes) : pdfBytes;
    const pdf = await pdfjs.getDocument({ data, useSystemFonts: true, disableFontFace: true }).promise;

    const byPage = new Map();
    for (const plan of plans) {
        const page = plan.mapping.page ?? 0;
        if (!byPage.has(page)) byPage.set(page, []);
        byPage.get(page).push(plan);
    }

    const colors = new Map();
    const scale = 2.5;

    for (const [pageIndex, pagePlans] of byPage) {
        const page = await pdf.getPage(pageIndex + 1);
        const viewport = page.getViewport({ scale });
        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport, intent: 'print' }).promise;

        for (const plan of pagePlans) {
            const { mapping, coverX, coverY, coverWidth, coverHeight } = plan;
            const fontSize = mapping.fontSize || 11;
            const samples = [];

            // Sample OUTSIDE glyph ink and away from table grid lines.
            // 1) Thin strip immediately LEFT of the value (cell padding / page bg)
            const left = readSample(
                ctx, canvas, viewport,
                Math.max(0, coverX - 5),
                coverY + coverHeight * 0.3,
                4,
                Math.max(2, coverHeight * 0.4),
                scale,
            );
            if (left) samples.push(left);

            // 2) Thin strip ABOVE the glyph ink (avoid top border of table cells)
            const above = readSample(
                ctx, canvas, viewport,
                coverX + 1,
                coverY + coverHeight - Math.max(2, fontSize * 0.18),
                Math.max(6, Math.min(coverWidth * 0.4, 28)),
                Math.max(2, fontSize * 0.15),
                scale,
            );
            if (above) samples.push(above);

            // 3) Thin strip RIGHT of the value (inside cell, away from vertical grid)
            const right = readSample(
                ctx, canvas, viewport,
                coverX + Math.max(coverWidth - 2, 4),
                coverY + coverHeight * 0.3,
                3,
                Math.max(2, coverHeight * 0.4),
                scale,
            );
            if (right) samples.push(right);

            // 4) Fallback: top-left interior of the cover region
            if (!samples.length) {
                const corner = readSample(
                    ctx, canvas, viewport,
                    coverX + 1,
                    coverY + coverHeight - 3,
                    Math.min(10, Math.max(4, coverWidth - 2)),
                    2,
                    scale,
                );
                if (corner) samples.push(corner);
            }

            colors.set(
                mappingColorKey(mapping),
                samples.length ? pickBestBackgroundSample(samples) : { r: 1, g: 1, b: 1 },
            );
        }
        page.cleanup();
    }

    await pdf.destroy();
    return colors;
}

export default {
    samplePdfBackgroundColors,
    averageRgbFromImageData,
    sanitizeSampledBackground,
    pickBestBackgroundSample,
};
