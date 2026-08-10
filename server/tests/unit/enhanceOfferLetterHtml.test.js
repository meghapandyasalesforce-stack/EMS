import { describe, it, expect } from '@jest/globals';
import { enhanceOfferLetterHtml } from '../../helpers/enhanceOfferLetterHtml.js';

describe('enhanceOfferLetterHtml', () => {
    it('styles company header and title without keeping blanket bold on body', () => {
        const html = `
            <p><b>PAARSIV TECHNOLOGIES PRIVATE LIMITED</b></p>
            <p><b>OFFER OF EMPLOYMENT</b></p>
            <p><b>Date: 5 August 2026</b></p>
            <p><b>Subject: Offer of Employment – Web Intern</b></p>
            <p><b>To,</b></p>
            <p><b>Jane Doe</b></p>
            <p><b>jane@example.com</b></p>
            <p><b>Dear Jane Doe,</b></p>
            <p><b>We are pleased to offer you employment with our organization.</b></p>
        `;
        const result = enhanceOfferLetterHtml(html);
        expect(result).toContain('offer-company-name');
        expect(result).toContain('offer-doc-title');
        expect(result).toContain('offer-recipient-detail');
        expect(result).toContain('class="offer-paragraph"');
        expect(result).not.toContain('<b>We are pleased');
    });

    it('strips literal nbsp from position detail table values', () => {
        const html = `
            <p><b>POSITION DETAILS</b></p>
            <p><b>Position:&nbsp;&nbsp;&nbsp;&nbsp;Web Intern</b></p>
            <p><b>Department:&nbsp;&nbsp;IT</b></p>
            <p><b>Reporting Manager:&nbsp;&nbsp;</b></p>
        `;
        const result = enhanceOfferLetterHtml(html);
        expect(result).not.toContain('&nbsp;');
        expect(result).toContain('Web Intern');
        expect(result).toContain('IT');
        expect(result).toContain('offer-info-table');
    });

    it('decodes double-encoded nbsp entities so raw &nbsp; never appears', () => {
        const html = `
            <p><b>POSITION DETAILS</b></p>
            <p><b>Position:&amp;nbsp;&amp;nbsp;&amp;nbsp;&amp;nbsp;Web Intern</b></p>
        `;
        const result = enhanceOfferLetterHtml(html);
        expect(result).not.toContain('&nbsp;');
        expect(result).not.toContain('&amp;nbsp;');
        expect(result).toContain('Web Intern');
        expect(result).toContain('offer-info-table');
    });

    it('does not escapeHtml table cell nbsp into visible &amp;nbsp;', () => {
        const html = `
            <table>
                <tr><td>Position</td><td>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Web Intern</td></tr>
                <tr><td>Department</td><td>IT &amp; Administration</td></tr>
            </table>
        `;
        const result = enhanceOfferLetterHtml(html);
        expect(result).not.toContain('&amp;nbsp;');
        expect(result).not.toMatch(/&nbsp;/i);
        expect(result).toContain('Web Intern');
        expect(result).toContain('IT &amp; Administration');
        expect(result).toContain('offer-data-table');
    });

    it('styles existing HTML tables professionally without raw entities', () => {
        const html = `
            <p><b>POSITION DETAILS</b></p>
            <table>
                <tr><td>Position</td><td>&nbsp;&nbsp;Web Intern</td></tr>
                <tr><td>Department</td><td>IT</td></tr>
            </table>
        `;
        const result = enhanceOfferLetterHtml(html);
        expect(result).toContain('offer-data-table');
        expect(result).not.toContain('&nbsp;');
        expect(result).toContain('Web Intern');
    });

    it('never renders embedded CSS as visible document text', () => {
        const html = `
            <style>
            .offer-letter {
                max-width: 850px;
                margin: 0 auto;
                padding: 45px 55px;
            }
            </style>
            <p><b>OFFER OF EMPLOYMENT</b></p>
            <p>Dear Jane Doe,</p>
            <p>max-width: 850px;</p>
            <p>.offer-letter { margin: 0 auto; }</p>
        `;
        const result = enhanceOfferLetterHtml(html);
        expect(result).not.toContain('<style');
        expect(result).not.toContain('max-width: 850px');
        expect(result).not.toContain('.offer-letter');
        expect(result).not.toContain('padding: 45px');
        expect(result).toContain('offer-doc-title');
        expect(result).toContain('Dear Jane Doe');
    });

    it('classifies POSITION DETAILS as section title not company name', () => {
        const html = `
            <p><b>POSITION DETAILS</b></p>
            <p><b>Position: Web Intern</b></p>
        `;
        const result = enhanceOfferLetterHtml(html);
        expect(result).toContain('offer-section-title');
        expect(result).toContain('POSITION DETAILS');
        expect(result).not.toMatch(/offer-company-name">POSITION DETAILS/);
    });

    it('merges br breaks inside body paragraphs', () => {
        const html = '<p><b>We are pleased to offer you<br>the position of Web Intern at Paarsiv.</b></p>';
        const result = enhanceOfferLetterHtml(html);
        expect(result).toContain('offer-paragraph');
        expect(result).toContain('Web Intern at Paarsiv');
        expect(result).not.toContain('<br');
    });

    it('groups position details into a two-column table', () => {
        const html = `
            <p><b>POSITION DETAILS</b></p>
            <p><b>Position: Web Intern</b></p>
            <p><b>Department: IT</b></p>
            <p><b>Reporting Manager: Arun</b></p>
            <p><b>Employment Type: Full-time</b></p>
            <p><b>Work Location: Jaipur</b></p>
            <p><b>Date of Joining: 5 August 2026</b></p>
        `;
        const result = enhanceOfferLetterHtml(html);
        expect(result).toContain('offer-info-table');
        expect(result).toContain('Position');
        expect(result).toContain('Web Intern');
        expect(result).toContain('offer-td-label');
    });

    it('groups compensation lines into a salary table with total row', () => {
        const html = `
            <p><b>COMPENSATION</b></p>
            <p><b>Basic Salary: Rs 20,000</b></p>
            <p><b>HRA: Rs 8,000</b></p>
            <p><b>Total CTC: Rs 12,00,000</b></p>
        `;
        const result = enhanceOfferLetterHtml(html);
        expect(result).toContain('offer-comp-table');
        expect(result).toContain('Component');
        expect(result).toContain('Amount');
        expect(result).toContain('offer-total-row');
    });

    it('preserves existing tables with offer-data-table class', () => {
        const html = '<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>';
        const result = enhanceOfferLetterHtml(html);
        expect(result).toContain('offer-data-table');
    });
});
