import { describe, it, expect } from '@jest/globals';
import {
    expandMappingsForAllOccurrences,
    enrichMappingsWithSampleValues,
    buildHeuristicMappingsFromPdfText,
    prepareMappingsForFill,
} from '../../helpers/pdfPlaceholderMappings.js';
import { fillPdfTemplateMappings } from '../../helpers/pdfTemplateFiller.js';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { extractPdfTextItems } from '../../helpers/pdfTextExtractor.js';

describe('pdfMappingExpansion', () => {
    it('maps all occurrences of the candidate name across the PDF', () => {
        const items = [
            { text: 'Kunal Pareek', page: 0, x: 72, y: 720, width: 80, height: 12, fontSize: 12 },
            { text: 'Jaipur', page: 0, x: 72, y: 705, width: 40, height: 12, fontSize: 12 },
            { text: 'Dear Kunal Pareek,', page: 0, x: 72, y: 680, width: 120, height: 12, fontSize: 12 },
            { text: 'Kunal Pareek', page: 1, x: 72, y: 200, width: 80, height: 12, fontSize: 12 },
        ];
        const base = buildHeuristicMappingsFromPdfText(items);
        const prepared = prepareMappingsForFill(base, items);
        const nameMappings = prepared.filter((m) => (m.fillPattern || '').includes('candidateName'));
        expect(nameMappings.length).toBeGreaterThanOrEqual(3);
    });

    it('partially replaces only the date segment in a long sentence', async () => {
        const sourceLine = 'To accept this offer, please sign and return this letter by 5/8/2026. Upon';
        const doc = await PDFDocument.create();
        const page = doc.addPage();
        const font = await doc.embedFont(StandardFonts.TimesRoman);
        page.drawText(sourceLine, { x: 72, y: 700, size: 12, font });
        const sourceBytes = Buffer.from(await doc.save());

        const items = await extractPdfTextItems(sourceBytes);
        const mappings = prepareMappingsForFill(buildHeuristicMappingsFromPdfText(items), items);

        const filled = await fillPdfTemplateMappings({
            templatePdfBytes: sourceBytes,
            mappings,
            placeholderMap: { '{{offerExpiryDate}}': '15/9/2026' },
            extractedItems: items,
        });

        const reread = await extractPdfTextItems(filled);
        const joined = reread.map((i) => i.text).join(' ');
        expect(joined).toMatch(/15\/9\/2026|15\/9/);
        expect(joined).toContain('accept this offer');
    });
});
