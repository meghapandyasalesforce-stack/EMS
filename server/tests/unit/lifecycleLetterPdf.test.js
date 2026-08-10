import { describe, it, expect, afterAll } from '@jest/globals';
import { PDFParse } from 'pdf-parse';
import {
    applyPlaceholders,
    buildLetterHtml,
    generateLetterPdf,
} from '../../helpers/lifecycleLetterPdf.js';
import { buildLetterPdfHtmlDocument } from '../../helpers/letterPdfHtmlDocument.js';
import { closePdfBrowser } from '../../helpers/htmlToPdfBuffer.js';
import fs from 'fs';

const TEST_ORG_ID = 'pdf-test-org';

async function extractPdfText(fullPath) {
    const buffer = fs.readFileSync(fullPath);
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    return { text: result.text || '', pages: result.total || 0 };
}

afterAll(async () => {
    await closePdfBrowser();
});

describe('lifecycleLetterPdf HTML rendering', () => {
    it('buildLetterPdfHtmlDocument wraps body with preview-matching styles', () => {
        const html = buildLetterPdfHtmlDocument({
            bodyHtml: '<p><b>OFFER OF EMPLOYMENT</b></p>',
        });
        expect(html).toContain('<!DOCTYPE html>');
        expect(html).toContain('letter-body');
        expect(html).toContain('<b>OFFER OF EMPLOYMENT</b>');
        expect(html).toContain('border-collapse: collapse');
        // A4 inset must come from @page — margin:0 caused edge-hugging PDFs with preferCSSPageSize
        expect(html).toMatch(/@page\s*\{\s*size:\s*A4;\s*margin:\s*18mm\s+18mm\s+18mm\s+18mm\s*;/);
        expect(html).not.toMatch(/@page\s*\{\s*size:\s*A4;\s*margin:\s*0\s*;/);
    });

    it('generates a simple offer PDF with candidate-specific values', async () => {
        const bodyHtml = `
            <p>Dear Jane Doe,</p>
            <p><b>OFFER OF EMPLOYMENT</b></p>
            <p>Position: Senior Engineer</p>
            <p>Annual CTC: Rs 12,00,000</p>
        `;
        const pdf = await generateLetterPdf({
            organizationId: TEST_ORG_ID,
            prefix: 'offer',
            bodyHtml,
            fileName: 'offer-simple-test.pdf',
        });

        expect(pdf.fullPath).toBeTruthy();
        expect(fs.existsSync(pdf.fullPath)).toBe(true);

        const { text } = await extractPdfText(pdf.fullPath);
        expect(text).toContain('Jane Doe');
        expect(text).toContain('OFFER OF EMPLOYMENT');
        expect(text).toContain('Senior Engineer');
        expect(text).not.toContain('<p>');
        expect(text).not.toContain('{{candidateName}}');
    });

    it('generates offer PDF with salary table', async () => {
        const bodyHtml = `
            <p><b>Compensation</b></p>
            <table>
                <tr><th>Component</th><th>Monthly</th><th>Annual</th></tr>
                <tr><td>Basic Salary</td><td>Rs 50,000</td><td>Rs 6,00,000</td></tr>
                <tr><td>HRA</td><td>Rs 20,000</td><td>Rs 2,40,000</td></tr>
                <tr><td>Total CTC</td><td>Rs 1,00,000</td><td>Rs 12,00,000</td></tr>
            </table>
        `;
        const pdf = await generateLetterPdf({
            organizationId: TEST_ORG_ID,
            prefix: 'offer',
            bodyHtml,
            fileName: 'offer-table-test.pdf',
        });

        const { text } = await extractPdfText(pdf.fullPath);
        expect(text).toContain('Component');
        expect(text).toContain('Basic Salary');
        expect(text).toContain('Rs 50,000');
        expect(text).toContain('Total CTC');
        expect(text).not.toContain('<table>');
    });

    it('generates multi-page PDF for long offers', async () => {
        const paragraphs = Array.from({ length: 40 }, (_, i) => `<p>Section ${i + 1}: This paragraph adds length to force pagination in the generated offer letter document.</p>`).join('');
        const bodyHtml = `<p><b>LONG OFFER LETTER</b></p>${paragraphs}`;

        const pdf = await generateLetterPdf({
            organizationId: TEST_ORG_ID,
            prefix: 'offer',
            bodyHtml,
            fileName: 'offer-long-test.pdf',
            includePageNumbers: true,
        });

        const { text, pages } = await extractPdfText(pdf.fullPath);
        expect(pages).toBeGreaterThan(1);
        expect(text).toContain('LONG OFFER LETTER');
        expect(text).toContain('Section 40');
    });

    it('preserves bold and heading text without HTML tags', async () => {
        const bodyHtml = `
            <h2>PAARSIV TECHNOLOGIES PRIVATE LIMITED</h2>
            <p><b>OFFER OF EMPLOYMENT</b></p>
            <p><i>Confidential</i></p>
        `;
        const pdf = await generateLetterPdf({
            organizationId: TEST_ORG_ID,
            prefix: 'offer',
            bodyHtml,
            fileName: 'offer-formatting-test.pdf',
        });

        const { text } = await extractPdfText(pdf.fullPath);
        expect(text).toContain('PAARSIV TECHNOLOGIES PRIVATE LIMITED');
        expect(text).toContain('OFFER OF EMPLOYMENT');
        expect(text).toContain('Confidential');
        expect(text).not.toMatch(/<h2>/);
        expect(text).not.toMatch(/<b>/);
    });

    it('uses resolved HTML only — no unresolved placeholders in PDF', async () => {
        const bodyHtml = applyPlaceholders(
            '<p>Dear {{candidateName}}, your offer for {{position}} is attached.</p>',
            {
                '{{candidateName}}': 'Ravi Kumar',
                '{{position}}': 'Product Manager',
            },
        );
        const pdf = await generateLetterPdf({
            organizationId: TEST_ORG_ID,
            prefix: 'offer',
            bodyHtml,
            fileName: 'offer-resolved-test.pdf',
        });

        const { text } = await extractPdfText(pdf.fullPath);
        expect(text).toContain('Ravi Kumar');
        expect(text).toContain('Product Manager');
        expect(text).not.toContain('{{');
    });

    it('includes header and footer sections when provided', async () => {
        const pdf = await generateLetterPdf({
            organizationId: TEST_ORG_ID,
            prefix: 'offer',
            headerHtml: '<p>Acme Corp Pvt Ltd</p>',
            bodyHtml: '<p>Main offer content for the candidate.</p>',
            footerHtml: '<p>Authorized Signatory</p>',
            fileName: 'offer-header-footer-test.pdf',
        });

        const { text } = await extractPdfText(pdf.fullPath);
        expect(text).toContain('Acme Corp Pvt Ltd');
        expect(text).toContain('Main offer content');
        expect(text).toContain('Authorized Signatory');
    });

    it('renders entity-encoded HTML in PDF without showing raw tags', async () => {
        const encodedBody = '&lt;p&gt;&lt;b&gt;PAARSIV TECHNOLOGIES PRIVATE LIMITED&lt;/b&gt;&lt;/p&gt;&lt;p&gt;Dear Jane Doe,&lt;/p&gt;&lt;p&gt;Position: Senior Engineer&lt;/p&gt;';
        const pdf = await generateLetterPdf({
            organizationId: TEST_ORG_ID,
            prefix: 'offer',
            bodyHtml: encodedBody,
            fileName: 'offer-encoded-html-test.pdf',
        });

        const { text } = await extractPdfText(pdf.fullPath);
        expect(text).toContain('PAARSIV TECHNOLOGIES');
        expect(text).toContain('Jane Doe');
        expect(text).toContain('Senior Engineer');
        expect(text).not.toContain('<p>');
        expect(text).not.toContain('&lt;p&gt;');
    });

    it('buildLetterHtml still composes header/body/footer', () => {
        const html = buildLetterHtml({
            headerHtml: '<p>{{companyName}}</p>',
            bodyHtml: '<p>Hello {{candidateName}}</p>',
            footerHtml: '<p>Regards</p>',
            data: {
                '{{companyName}}': 'Acme',
                '{{candidateName}}': 'Bob',
            },
        });
        expect(html).toContain('Acme');
        expect(html).toContain('Bob');
        expect(html).toContain('Regards');
    });
});
