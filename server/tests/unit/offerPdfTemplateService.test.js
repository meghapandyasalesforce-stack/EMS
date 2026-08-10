import { describe, it, expect } from '@jest/globals';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import {
    extractPdfTextItems,
    hasSelectableText,
} from '../../helpers/pdfTextExtractor.js';
import { fillPdfTemplateMappings } from '../../helpers/pdfTemplateFiller.js';
import {
    buildItemKey,
    normalizeSavedMapping,
    validatePdfMappingConfig,
    validatePdfMappingsAgainstPlaceholders,
} from '../../helpers/pdfPlaceholderMappings.js';

async function buildSampleOfferPdf() {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText('Dear abc singh,', { x: 72, y: 700, size: 12, font });
    page.drawText('Email: abc@gmail', { x: 72, y: 680, size: 12, font });
    page.drawText('We Intern at our company.', { x: 72, y: 660, size: 12, font });
    return Buffer.from(await doc.save());
}

describe('pdfPlaceholderMappings', () => {
    it('normalizeSavedMapping stores exact bounding box from itemKey', async () => {
        const buffer = await buildSampleOfferPdf();
        const items = await extractPdfTextItems(buffer);
        const nameItem = items.find((i) => i.text.includes('abc singh'));
        expect(nameItem).toBeTruthy();

        const mapping = normalizeSavedMapping({
            placeholderToken: 'candidateName',
            itemKey: buildItemKey(nameItem),
            sourceText: 'abc singh',
            page: nameItem.page,
            x: nameItem.x + 18,
            y: nameItem.y,
            width: 50,
            height: nameItem.height,
            fontSize: nameItem.fontSize,
        }, items);

        expect(mapping).toBeTruthy();
        expect(mapping.page).toBe(nameItem.page);
        expect(mapping.y).toBe(nameItem.y);
        expect(mapping.width).toBeGreaterThan(0);
        expect(mapping.height).toBeGreaterThan(0);
        expect(mapping.sourceText).toBe('abc singh');
    });

    it('validatePdfMappingConfig requires candidateName and position (not email)', () => {
        const result = validatePdfMappingConfig([
            {
                placeholderToken: 'candidateName',
                sourceText: 'abc singh',
                width: 80,
                height: 12,
            },
        ]);
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.token === 'position')).toBe(true);
        expect(result.errors.some((e) => e.token === 'email' || String(e.message).includes('Email'))).toBe(false);
    });

    it('fillPdfTemplateMappings replaces only mapped bbox without keeping old value', async () => {
        const buffer = await buildSampleOfferPdf();
        const items = await extractPdfTextItems(buffer);
        const nameItem = items.find((i) => i.text.includes('abc singh'));
        const positionItem = items.find((i) => i.text.includes('Intern'));

        const mappings = [
            normalizeSavedMapping({
                placeholderToken: 'candidateName',
                sourceText: 'abc singh',
                page: nameItem.page,
                x: nameItem.x + 18,
                y: nameItem.y,
                width: 50,
                height: nameItem.height,
                fontSize: nameItem.fontSize,
            }, items),
            normalizeSavedMapping({ placeholderToken: 'email', itemKey: '0|1|1|hr@paarsiv.com', sourceText: 'hr@paarsiv.com' }, items),
            normalizeSavedMapping({ placeholderToken: 'position', itemKey: buildItemKey(positionItem), sourceText: positionItem.text }, items),
        ].filter(Boolean);

        expect(mappings.some((m) => m.placeholderToken === 'email')).toBe(false);

        const filled = await fillPdfTemplateMappings({
            templatePdfBytes: buffer,
            mappings,
            placeholderMap: {
                '{{candidateName}}': 'Jane Doe',
                '{{email}}': 'jane@example.com',
                '{{position}}': 'Engineer',
            },
            extractedTextItems: items,
        });

        const reread = await extractPdfTextItems(filled);
        const joined = reread.map((i) => i.text).join(' ');
        expect(joined).toContain('Jane Doe');
        expect(joined).toContain('Engineer');
        expect(joined).not.toContain('jane@example.com');
        expect(Buffer.compare(buffer, filled)).not.toBe(0);
    });

    it('validatePdfMappingsAgainstPlaceholders flags missing values', () => {
        const result = validatePdfMappingsAgainstPlaceholders([
            { placeholderToken: 'candidateName', label: 'Candidate Name', required: true },
        ], {
            '{{candidateName}}': '',
        });
        expect(result.ok).toBe(false);
    });

    it('hasSelectableText detects extractable content', () => {
        expect(hasSelectableText([{ text: 'Hello' }])).toBe(true);
        expect(hasSelectableText([])).toBe(false);
    });
});
