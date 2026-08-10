import { describe, it, expect } from '@jest/globals';
import {
    normalizeRichHtml,
    repairEscapedHtmlEntities,
} from '../../helpers/normalizeRichHtml.js';
import { buildLetterPdfHtmlDocument } from '../../helpers/letterPdfHtmlDocument.js';

describe('HTML entity repair for offer letter PDF', () => {
    it('repairEscapedHtmlEntities turns &amp;nbsp; back into &nbsp; for the browser', () => {
        const input = '<td>&amp;nbsp;&amp;nbsp;&amp;nbsp;Web Intern</td>';
        const repaired = repairEscapedHtmlEntities(input);
        expect(repaired).toBe('<td>&nbsp;&nbsp;&nbsp;Web Intern</td>');
        expect(repaired).not.toContain('&amp;nbsp;');
    });

    it('preserves correctly encoded ampersands for text like IT & Administration', () => {
        const input = '<td>IT &amp; Administration</td>';
        expect(repairEscapedHtmlEntities(input)).toBe('<td>IT &amp; Administration</td>');
        expect(normalizeRichHtml(input)).toBe('<td>IT &amp; Administration</td>');
    });

    it('buildLetterPdfHtmlDocument does not leave double-encoded nbsp in the PDF HTML', () => {
        const doc = buildLetterPdfHtmlDocument({
            bodyHtml: '<table class="offer-data-table"><tr><td>Position</td><td>&amp;nbsp;&amp;nbsp;Web Intern</td></tr></table>',
        });
        expect(doc).not.toContain('&amp;nbsp;');
        expect(doc).toContain('&nbsp;&nbsp;Web Intern');
        expect(doc).toContain('offer-data-table');
    });
});
