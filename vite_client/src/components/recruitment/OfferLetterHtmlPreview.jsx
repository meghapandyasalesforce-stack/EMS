import React from 'react';
import { enhanceOfferLetterHtml, OFFER_LETTER_PRESENTATION_STYLES } from '../../utils/offerLetterHtmlEnhance';

/** Decode HTML entity-encoded content (xss-clean artifact) before rendering. */
export function normalizeRichHtml(html) {
    if (html == null || html === '') return '';
    let value = String(html);

    for (let i = 0; i < 5; i += 1) {
        const needsDecode = /&lt;\/?(?:p|b|strong|table|div|h[1-6]|br|ul|ol|li|td|th|tr|span|em|i|a)\b/i.test(value)
            || /&amp;lt;|&#60;|&#x3c;/i.test(value)
            || /&amp;(?:nbsp|lt|gt|quot|amp|#39);|&nbsp;|&#160;/i.test(value);
        if (!needsDecode) break;
        const next = value
            .replace(/&nbsp;/gi, ' ')
            .replace(/&#160;/g, ' ')
            .replace(/&#x0*a0;/gi, ' ')
            .replace(/\u00a0/g, ' ')
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
        if (next === value) break;
        value = next;
    }

    return value;
}

export function OfferLetterHtmlPreview({ html, className = '' }) {
    const renderedHtml = enhanceOfferLetterHtml(html) || '<p class="offer-paragraph">No preview content</p>';
    return (
        <div className="offer-letter-shell">
            <style>{OFFER_LETTER_PRESENTATION_STYLES}</style>
            <div
                className={`offer-letter-html ${className}`.trim()}
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
        </div>
    );
}

export function OfferMissingFieldsAlert({ missingFields = [] }) {
    if (!missingFields.length) return null;
    return (
        <div
            className="mb-4 rounded-lg border px-4 py-3 text-sm"
            style={{
                borderColor: 'rgba(234, 88, 12, 0.35)',
                background: 'rgba(255, 237, 213, 0.45)',
                color: '#9a3412',
            }}
        >
            <p className="font-semibold">Missing offer information</p>
            <ul className="mt-2 list-disc pl-5">
                {missingFields.map((field) => (
                    <li key={field.token || field.label}>{field.label}</li>
                ))}
            </ul>
            <p className="mt-2 text-xs opacity-90">
                Fill in the required details before generating the final offer letter.
            </p>
        </div>
    );
}

export default OfferLetterHtmlPreview;
