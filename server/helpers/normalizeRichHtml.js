/**
 * Normalize rich HTML stored/sent through the API.
 * Global xss-clean encodes `<` as `&lt;` in req.body, which breaks offer letter HTML.
 */

const ENCODED_HTML_PATTERN = /&lt;\/?(?:p|b|strong|table|div|h[1-6]|br|ul|ol|li|td|th|tr|span|em|i|a)\b/i;
const DOUBLE_ENCODED_PATTERN = /&amp;lt;|&#60;|&#x3c;/i;
const ENCODED_ENTITY_PATTERN = /&amp;(?:nbsp|ensp|emsp|lt|gt|quot|amp|#39|#160|#x0*a0);?|&nbsp;?|&ensp;?|&emsp;?|&#160;|&#8194;|&#8195;|&#x0*a0;/i;

function decodeHtmlEntitiesOnce(value) {
    return value
        // Undo double-encoding before turning &amp; into &
        .replace(/&amp;nbsp;?/gi, ' ')
        .replace(/&amp;ensp;?/gi, ' ')
        .replace(/&amp;emsp;?/gi, ' ')
        .replace(/&amp;#160;/gi, ' ')
        .replace(/&amp;#x0*a0;/gi, ' ')
        .replace(/&nbsp;?/gi, ' ')
        .replace(/&ensp;?/gi, ' ')
        .replace(/&emsp;?/gi, ' ')
        .replace(/&#160;/g, ' ')
        .replace(/&#8194;/g, ' ')
        .replace(/&#8195;/g, ' ')
        .replace(/&#x0*a0;/gi, ' ')
        .replace(/\u00a0/g, ' ')
        .replace(/\u2002/g, ' ')
        .replace(/\u2003/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/gi, "'")
        .replace(/&#60;/g, '<')
        .replace(/&#62;/g, '>')
        .replace(/&#x3c;/gi, '<')
        .replace(/&#x3e;/gi, '>');
}

export function normalizeRichHtml(html) {
    if (html == null || html === '') return '';
    let value = String(html);

    for (let i = 0; i < 5; i += 1) {
        const needsDecode = ENCODED_HTML_PATTERN.test(value)
            || DOUBLE_ENCODED_PATTERN.test(value)
            || ENCODED_ENTITY_PATTERN.test(value);
        if (!needsDecode) break;
        const next = decodeHtmlEntitiesOnce(value);
        if (next === value) break;
        value = next;
    }

    return value;
}

/**
 * Repair double-escaped HTML entities so Puppeteer/Chromium interprets them.
 * Root issue: escapeHtml() turns "&nbsp;" into "&amp;nbsp;", which renders as literal text.
 * This restores valid single-encoded entities (or spaces for nbsp) without touching layout/CSS.
 */
export function repairEscapedHtmlEntities(html = '') {
    let value = String(html);
    for (let i = 0; i < 5; i += 1) {
        const next = value
            .replace(/&amp;nbsp;?/gi, '&nbsp;')
            .replace(/&amp;ensp;?/gi, '&ensp;')
            .replace(/&amp;emsp;?/gi, '&emsp;')
            .replace(/&amp;#160;/gi, '&#160;')
            .replace(/&amp;#x0*a0;/gi, '&#160;')
            .replace(/&amp;lt;/gi, '&lt;')
            .replace(/&amp;gt;/gi, '&gt;')
            .replace(/&amp;quot;/gi, '&quot;')
            .replace(/&amp;#39;/gi, '&#39;')
            .replace(/&amp;amp;/g, '&amp;');
        if (next === value) break;
        value = next;
    }
    return value;
}

export function normalizeRichHtmlFields(source = {}, fields = ['bodyHtml', 'headerHtml', 'footerHtml', 'renderedHtml']) {
    if (!source || typeof source !== 'object') return source;
    const result = { ...source };
    for (const field of fields) {
        if (typeof result[field] === 'string') {
            result[field] = normalizeRichHtml(result[field]);
        }
    }
    return result;
}

export default { normalizeRichHtml, normalizeRichHtmlFields, repairEscapedHtmlEntities };
