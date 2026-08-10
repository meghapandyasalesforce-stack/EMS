/**
 * Preserve trusted rich HTML fields through global xss-clean middleware.
 * Offer/lifecycle letter templates intentionally store HTML from HR editors.
 */

const RICH_HTML_FIELDS = ['bodyHtml', 'headerHtml', 'footerHtml', 'renderedHtml'];
const RICH_HTML_PATH_RE = /^\/api\/v1\/admin\/lifecycle\/(offers|letters)/;

export function stashRichHtmlFields(req, res, next) {
    if (!RICH_HTML_PATH_RE.test(req.path || '') || !req.body || typeof req.body !== 'object') {
        return next();
    }

    req._richHtmlPreserve = {};
    for (const field of RICH_HTML_FIELDS) {
        if (typeof req.body[field] === 'string') {
            req._richHtmlPreserve[field] = req.body[field];
        }
    }
    next();
}

export function restoreRichHtmlFields(req, res, next) {
    if (!req._richHtmlPreserve || !req.body || typeof req.body !== 'object') {
        return next();
    }

    for (const [field, value] of Object.entries(req._richHtmlPreserve)) {
        req.body[field] = value;
    }
    delete req._richHtmlPreserve;
    next();
}

export default { stashRichHtmlFields, restoreRichHtmlFields };
