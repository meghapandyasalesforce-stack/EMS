import { describe, it, expect } from '@jest/globals';
import { normalizeRichHtml, normalizeRichHtmlFields } from '../../helpers/normalizeRichHtml.js';

describe('normalizeRichHtml', () => {
    it('decodes xss-clean entity-encoded HTML', () => {
        const encoded = '&lt;p>&lt;b>PAARSIV TECHNOLOGIES&lt;/b>&lt;/p>';
        expect(normalizeRichHtml(encoded)).toBe('<p><b>PAARSIV TECHNOLOGIES</b></p>');
    });

    it('leaves valid HTML unchanged', () => {
        const html = '<p><b>OFFER OF EMPLOYMENT</b></p>';
        expect(normalizeRichHtml(html)).toBe(html);
    });

    it('decodes double-encoded HTML entities', () => {
        const encoded = '&amp;lt;p&amp;gt;Hello&amp;lt;/p&amp;gt;';
        expect(normalizeRichHtml(encoded)).toBe('<p>Hello</p>');
    });

    it('normalizes rich html fields on objects', () => {
        const result = normalizeRichHtmlFields({
            bodyHtml: '&lt;p>Hello&lt;/p>',
            name: 'Default Template',
        });
        expect(result.bodyHtml).toBe('<p>Hello</p>');
        expect(result.name).toBe('Default Template');
    });
});
