import { describe, it, expect } from '@jest/globals';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import {
    extractPdfTextItems,
    hasSelectableText,
} from '../../helpers/pdfTextExtractor.js';
import {
    detectPdfFields,
    detectionsToFieldMappings,
    buildVerificationFieldList,
    confidenceLevel,
    groupTextItemsIntoLines,
    CONFIDENCE_HIGH,
    CONFIDENCE_MEDIUM,
} from '../../helpers/pdfFieldDetector.js';
import { fillPdfTemplateMappings } from '../../helpers/pdfTemplateFiller.js';
import {
    buildItemKey,
    normalizeSavedMapping,
    validatePdfMappingConfig,
    validatePdfMappingsAgainstPlaceholders,
} from '../../helpers/pdfPlaceholderMappings.js';
import { applyPdfDateFormatting, formatOfferDateProfessional } from '../../helpers/offerPlaceholderResolver.js';

async function buildSampleOfferPdf() {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const lines = [
        'Candidate Name: abc singh',
        'Email: abc@gmail.com',
        'Position: Web Intern',
        'Department: IT',
        'Reporting Manager: Arun',
        'Salary: Rs 2,344',
        'Location: Jaipur',
        'Joining Date: 05/08/2026',
    ];
    let y = 700;
    for (const line of lines) {
        page.drawText(line, { x: 72, y, size: 12, font });
        y -= 20;
    }
    return Buffer.from(await doc.save());
}

describe('pdfFieldDetector', () => {
    it('groups text items into reading-order lines', async () => {
        const buffer = await buildSampleOfferPdf();
        const items = await extractPdfTextItems(buffer);
        const lines = groupTextItemsIntoLines(items);
        expect(lines.length).toBeGreaterThanOrEqual(8);
        expect(lines.some((l) => l.text.includes('abc singh'))).toBe(true);
    });

    it('detects candidate name from label context', async () => {
        const buffer = await buildSampleOfferPdf();
        const items = await extractPdfTextItems(buffer);
        const { detections } = detectPdfFields(items);
        const name = detections.find((d) => d.placeholderToken === 'candidateName');
        expect(name).toBeTruthy();
        expect(name.sourceText).toContain('abc singh');
        expect(name.confidence).toBeGreaterThanOrEqual(CONFIDENCE_MEDIUM);
    });

    it('does not detect email as a PDF dynamic field (company letterhead stays static)', async () => {
        const buffer = await buildSampleOfferPdf();
        const items = await extractPdfTextItems(buffer);
        const { detections } = detectPdfFields(items);
        const email = detections.find((d) => d.placeholderToken === 'email');
        expect(email).toBeFalsy();
    });

    it('does not replace company header email with candidate email', async () => {
        const doc = await PDFDocument.create();
        const page = doc.addPage();
        const font = await doc.embedFont(StandardFonts.Helvetica);
        page.drawText('Paarsiv Technologies Pvt. Ltd.', { x: 72, y: 720, size: 12, font });
        page.drawText('hr@paarsiv.com', { x: 72, y: 700, size: 12, font });
        page.drawText('Website: https://www.paarsiv.com/', { x: 72, y: 680, size: 12, font });
        page.drawText('Name: abc singh', { x: 72, y: 640, size: 12, font });
        page.drawText('Position: Web Intern', { x: 72, y: 620, size: 12, font });
        const buffer = Buffer.from(await doc.save());
        const items = await extractPdfTextItems(buffer);
        const { detections } = detectPdfFields(items);
        expect(detections.find((d) => d.placeholderToken === 'email')).toBeFalsy();

        const mappings = detectionsToFieldMappings(detections)
            .map((m) => normalizeSavedMapping(m, items))
            .filter(Boolean);
        const filled = await fillPdfTemplateMappings({
            templatePdfBytes: buffer,
            mappings,
            placeholderMap: {
                '{{candidateName}}': 'Megha Pandya',
                '{{email}}': 'candidate@gmail.com',
                '{{position}}': 'Engineer',
            },
        });
        const joined = (await extractPdfTextItems(filled)).map((i) => i.text).join(' ');
        expect(joined).toContain('hr@paarsiv.com');
        expect(joined).not.toContain('candidate@gmail.com');
    });

    it('detects position from label context', async () => {
        const buffer = await buildSampleOfferPdf();
        const items = await extractPdfTextItems(buffer);
        const { detections } = detectPdfFields(items);
        const position = detections.find((d) => d.placeholderToken === 'position');
        expect(position).toBeTruthy();
        expect(position.sourceText).toBe('Web Intern');
    });

    it('detects department from label context', async () => {
        const buffer = await buildSampleOfferPdf();
        const items = await extractPdfTextItems(buffer);
        const { detections } = detectPdfFields(items);
        const dept = detections.find((d) => d.placeholderToken === 'department');
        expect(dept).toBeTruthy();
        expect(dept.sourceText).toBe('IT');
    });

    it('detects salary from label context', async () => {
        const buffer = await buildSampleOfferPdf();
        const items = await extractPdfTextItems(buffer);
        const { detections } = detectPdfFields(items);
        const salary = detections.find((d) => d.placeholderToken === 'salary');
        expect(salary).toBeTruthy();
        expect(salary.sourceText).toMatch(/2,344/);
    });

    it('detects joining date from label context', async () => {
        const buffer = await buildSampleOfferPdf();
        const items = await extractPdfTextItems(buffer);
        const { detections } = detectPdfFields(items);
        const startDate = detections.find((d) => d.placeholderToken === 'startDate');
        expect(startDate).toBeTruthy();
        expect(startDate.sourceText).toBe('05/08/2026');
    });

    it('detects reporting manager from label context', async () => {
        const buffer = await buildSampleOfferPdf();
        const items = await extractPdfTextItems(buffer);
        const { detections } = detectPdfFields(items);
        const mgr = detections.find((d) => d.placeholderToken === 'reportingManager');
        expect(mgr).toBeTruthy();
        expect(mgr.sourceText).toBe('Arun');
    });

    it('assigns confidence scores with high/medium/low levels', async () => {
        const buffer = await buildSampleOfferPdf();
        const items = await extractPdfTextItems(buffer);
        const { detections } = detectPdfFields(items);
        for (const d of detections) {
            expect(['high', 'medium', 'low']).toContain(d.confidenceLevel);
            expect(d.confidence).toBeGreaterThan(0);
            expect(d.confidence).toBeLessThanOrEqual(100);
        }
        const name = detections.find((d) => d.placeholderToken === 'candidateName');
        expect(name.confidenceLevel).toBe('high');
        expect(detections.find((d) => d.placeholderToken === 'email')).toBeFalsy();
    });

    it('stores coordinate bounding boxes for detected fields', async () => {
        const buffer = await buildSampleOfferPdf();
        const items = await extractPdfTextItems(buffer);
        const { detections } = detectPdfFields(items);
        const name = detections.find((d) => d.placeholderToken === 'candidateName');
        expect(name.page).toBeGreaterThanOrEqual(0);
        expect(name.x).toBeGreaterThan(0);
        expect(name.y).toBeGreaterThan(0);
        expect(name.width).toBeGreaterThan(0);
        expect(name.height).toBeGreaterThan(0);
        expect(name.itemKey).toBeTruthy();
    });

    it('does not detect fields without label context (standalone values)', async () => {
        const doc = await PDFDocument.create();
        const page = doc.addPage();
        const font = await doc.embedFont(StandardFonts.Helvetica);
        page.drawText('IT', { x: 72, y: 700, size: 12, font });
        page.drawText('Arun', { x: 72, y: 680, size: 12, font });
        const buffer = Buffer.from(await doc.save());
        const items = await extractPdfTextItems(buffer);
        const { detections } = detectPdfFields(items);
        expect(detections.find((d) => d.placeholderToken === 'department')).toBeFalsy();
        expect(detections.find((d) => d.placeholderToken === 'reportingManager')).toBeFalsy();
    });

    it('handles scanned PDF with no selectable text', () => {
        const result = detectPdfFields([]);
        expect(result.detectionStatus).toBe('no_text');
        expect(result.detections).toHaveLength(0);
        expect(hasSelectableText([])).toBe(false);
    });

    it('builds verification field list with not detected markers', async () => {
        const buffer = await buildSampleOfferPdf();
        const items = await extractPdfTextItems(buffer);
        const { detections } = detectPdfFields(items);
        const fields = buildVerificationFieldList(detections);
        expect(fields.find((f) => f.placeholderToken === 'candidateName')?.detected).toBe(true);
        // Undetected optional fields are omitted (only present PDF fields + required fallbacks)
        expect(fields.find((f) => f.placeholderToken === 'probationPeriod')).toBeFalsy();
    });

    it('converts detections to field mappings for accepted confidence', async () => {
        const buffer = await buildSampleOfferPdf();
        const items = await extractPdfTextItems(buffer);
        const { detections } = detectPdfFields(items);
        const mappings = detectionsToFieldMappings(detections);
        expect(mappings.length).toBeGreaterThan(0);
        expect(mappings.every((m) => m.placeholderToken && m.sourceText && m.x != null)).toBe(true);
    });
});

describe('pdfFieldDetector confidenceLevel', () => {
    it('classifies confidence thresholds correctly', () => {
        expect(confidenceLevel(95)).toBe('high');
        expect(confidenceLevel(CONFIDENCE_HIGH)).toBe('high');
        expect(confidenceLevel(70)).toBe('medium');
        expect(confidenceLevel(CONFIDENCE_MEDIUM)).toBe('medium');
        expect(confidenceLevel(40)).toBe('low');
    });
});

describe('pdf replacement integration', () => {
    it('replaces detected fields with new candidate values', async () => {
        const buffer = await buildSampleOfferPdf();
        const items = await extractPdfTextItems(buffer);
        const { detections } = detectPdfFields(items);
        const mappings = detectionsToFieldMappings(detections)
            .map((m) => normalizeSavedMapping(m, items))
            .filter(Boolean);

        const requiredMappings = ['candidateName', 'position'];
        for (const token of requiredMappings) {
            expect(mappings.some((m) => m.placeholderToken === token)).toBe(true);
        }

        const filled = await fillPdfTemplateMappings({
            templatePdfBytes: buffer,
            mappings,
            placeholderMap: {
                '{{candidateName}}': 'Megha Pandya',
                '{{position}}': 'MERN Developer',
                '{{department}}': 'Engineering',
                '{{reportingManager}}': 'John Smith',
                '{{salary}}': 'Rs 12,00,000',
                '{{location}}': 'Bengaluru',
                '{{startDate}}': '05 August 2026',
            },
        });

        const reread = await extractPdfTextItems(filled);
        const joined = reread.map((i) => i.text).join(' ');
        expect(joined).toContain('Megha');
        expect(joined).toContain('MERN Developer');
        expect(Buffer.compare(buffer, filled)).not.toBe(0);
    });

    it('handles long replacement values by fitting within bounding box', async () => {
        const buffer = await buildSampleOfferPdf();
        const items = await extractPdfTextItems(buffer);
        const positionItem = items.find((i) => i.text.includes('Web Intern'));
        const mapping = normalizeSavedMapping({
            placeholderToken: 'position',
            itemKey: buildItemKey(positionItem),
            sourceText: 'Web Intern',
        }, items);

        const filled = await fillPdfTemplateMappings({
            templatePdfBytes: buffer,
            mappings: [mapping],
            placeholderMap: {
                '{{position}}': 'Senior Full Stack MERN Developer',
            },
        });

        const reread = await extractPdfTextItems(filled);
        const joined = reread.map((i) => i.text).join(' ');
        expect(joined).toMatch(/Senior|Full|MERN|Developer/);
    });

    it('handles short replacement values without shifting layout', async () => {
        const buffer = await buildSampleOfferPdf();
        const items = await extractPdfTextItems(buffer);
        const nameItem = items.find((i) => i.text.includes('abc singh'));
        const mapping = normalizeSavedMapping({
            placeholderToken: 'candidateName',
            itemKey: buildItemKey(nameItem),
            sourceText: 'abc singh',
        }, items);

        const filled = await fillPdfTemplateMappings({
            templatePdfBytes: buffer,
            mappings: [mapping],
            placeholderMap: {
                '{{candidateName}}': 'Megha',
            },
        });

        const reread = await extractPdfTextItems(filled);
        expect(reread.some((i) => i.text.includes('Megha'))).toBe(true);
        expect(reread.some((i) => i.text.includes('Email:'))).toBe(true);
    });

    it('validates missing field values before generation', () => {
        const result = validatePdfMappingsAgainstPlaceholders([
            { placeholderToken: 'candidateName', label: 'Candidate Name', required: true },
            { placeholderToken: 'reportingManager', label: 'Reporting Manager', required: true },
        ], {
            '{{candidateName}}': 'Megha',
            '{{reportingManager}}': '',
        });
        expect(result.ok).toBe(false);
        expect(result.missing.some((m) => m.label === 'Reporting Manager')).toBe(true);
    });

    it('original PDF template bytes remain unchanged on disk', async () => {
        const buffer = await buildSampleOfferPdf();
        const originalCopy = Buffer.from(buffer);
        const items = await extractPdfTextItems(buffer);
        const { detections } = detectPdfFields(items);
        const mappings = detectionsToFieldMappings(detections)
            .map((m) => normalizeSavedMapping(m, items))
            .filter(Boolean);

        await fillPdfTemplateMappings({
            templatePdfBytes: buffer,
            mappings,
            placeholderMap: { '{{candidateName}}': 'New Name' },
        });

        expect(Buffer.compare(buffer, originalCopy)).toBe(0);
    });

    it('validatePdfMappingConfig requires candidateName and position (not email)', () => {
        const result = validatePdfMappingConfig([
            { placeholderToken: 'candidateName', sourceText: 'abc', width: 80, height: 12 },
        ]);
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.token === 'position')).toBe(true);
        expect(result.errors.some((e) => e.token === 'email')).toBe(false);
    });

    it('strips legacy email mappings on normalize', () => {
        const result = normalizeSavedMapping({
            placeholderToken: 'email',
            sourceText: 'hr@paarsiv.com',
            page: 0,
            x: 10,
            y: 10,
            width: 80,
            height: 12,
        }, []);
        expect(result).toBeNull();
    });

    it('does not treat bare Date label as joining date', async () => {
        const doc = await PDFDocument.create();
        const page = doc.addPage();
        const font = await doc.embedFont(StandardFonts.Helvetica);
        page.drawText('Date: 05/08/2026', { x: 72, y: 700, size: 12, font });
        page.drawText('Date of Joining: 10/09/2026', { x: 72, y: 680, size: 12, font });
        const buffer = Buffer.from(await doc.save());
        const items = await extractPdfTextItems(buffer);
        const { detections } = detectPdfFields(items);
        const startDates = detections.filter((d) => d.placeholderToken === 'startDate');
        expect(startDates).toHaveLength(1);
        expect(startDates[0].sourceText).toBe('10/09/2026');
    });

    it('never detects company name as candidate name', async () => {
        const doc = await PDFDocument.create();
        const page = doc.addPage();
        const font = await doc.embedFont(StandardFonts.Helvetica);
        page.drawText('PAARSIV TECHNOLOGIES PRIVATE LIMITED', { x: 72, y: 720, size: 12, font });
        page.drawText('Name: PAARSIV TECHNOLOGIES PRIVATE LIMITED', { x: 72, y: 700, size: 12, font });
        page.drawText('Candidate Name: Megha Pandya', { x: 72, y: 680, size: 12, font });
        const buffer = Buffer.from(await doc.save());
        const items = await extractPdfTextItems(buffer);
        const { detections } = detectPdfFields(items);
        const names = detections.filter((d) => d.placeholderToken === 'candidateName');
        expect(names.every((d) => !/PAARSIV|TECHNOLOGIES|PRIVATE/i.test(d.sourceText))).toBe(true);
        expect(names.some((d) => d.sourceText.includes('Megha'))).toBe(true);
    });

    it('detects salary in words when labelled', async () => {
        const doc = await PDFDocument.create();
        const page = doc.addPage();
        const font = await doc.embedFont(StandardFonts.Helvetica);
        page.drawText('Annual CTC: Rs 5,00,000', { x: 72, y: 700, size: 12, font });
        page.drawText('In Words: Five Lakh Rupees Only', { x: 72, y: 680, size: 12, font });
        const buffer = Buffer.from(await doc.save());
        const items = await extractPdfTextItems(buffer);
        const { detections } = detectPdfFields(items);
        const words = detections.find((d) => d.placeholderToken === 'salaryWords');
        expect(words).toBeTruthy();
        expect(words.sourceText).toMatch(/Five Lakh/i);
    });

    it('detects natural-language CTC in words', async () => {
        const doc = await PDFDocument.create();
        const page = doc.addPage();
        const font = await doc.embedFont(StandardFonts.Helvetica);
        page.drawText('Annual CTC: Rs 6,20,000', { x: 72, y: 700, size: 12, font });
        page.drawText('CTC of Rupees Six Lakh Twenty Thousand Only', { x: 72, y: 680, size: 12, font });
        const buffer = Buffer.from(await doc.save());
        const items = await extractPdfTextItems(buffer);
        const { detections } = detectPdfFields(items);
        const words = detections.find((d) => d.placeholderToken === 'salaryWords');
        expect(words).toBeTruthy();
        expect(words.sourceText).toMatch(/Rupees Six Lakh Twenty Thousand Only/i);
    });

    it('detects salary annexure rows including ESIC and total deductions', async () => {
        const doc = await PDFDocument.create();
        const page = doc.addPage();
        const font = await doc.embedFont(StandardFonts.Helvetica);
        page.drawText('Basic Salary 23,500 2,82,000', { x: 72, y: 700, size: 12, font });
        page.drawText('HRA 9,400 1,12,800', { x: 72, y: 680, size: 12, font });
        page.drawText('Employee ESIC 353 4,236', { x: 72, y: 660, size: 12, font });
        page.drawText('Total Deductions 3,173 38,076', { x: 72, y: 640, size: 12, font });
        page.drawText('Total CTC 51,667 6,20,000', { x: 72, y: 620, size: 12, font });
        const buffer = Buffer.from(await doc.save());
        const items = await extractPdfTextItems(buffer);
        const { detections } = detectPdfFields(items);
        expect(detections.find((d) => d.placeholderToken === 'basicSalary')?.sourceText).toMatch(/23,500/);
        expect(detections.find((d) => d.placeholderToken === 'basicSalaryAnnual')?.sourceText).toMatch(/2,82,000/);
        expect(detections.find((d) => d.placeholderToken === 'hra')?.sourceText).toMatch(/9,400/);
        expect(detections.find((d) => d.placeholderToken === 'employeeESI')?.sourceText).toMatch(/353/);
        expect(detections.find((d) => d.placeholderToken === 'totalDeductions')?.sourceText).toMatch(/3,173/);
        expect(detections.find((d) => d.placeholderToken === 'totalCTCMonthly')?.sourceText).toMatch(/51,667/);
        expect(detections.find((d) => d.placeholderToken === 'totalCTC')?.sourceText).toMatch(/6,20,000/);
    });

    it('detects prose joining date and notice period', async () => {
        const doc = await PDFDocument.create();
        const page = doc.addPage();
        const font = await doc.embedFont(StandardFonts.Helvetica);
        page.drawText('Your date of joining is 1st September 2026.', { x: 72, y: 700, size: 12, font });
        page.drawText('you will have a notice period of 60 days.', { x: 72, y: 680, size: 12, font });
        const buffer = Buffer.from(await doc.save());
        const items = await extractPdfTextItems(buffer);
        const { detections } = detectPdfFields(items);
        const start = detections.find((d) => d.placeholderToken === 'startDate');
        const notice = detections.find((d) => d.placeholderToken === 'noticePeriod');
        expect(start).toBeTruthy();
        expect(start.sourceText).toMatch(/1st September 2026/i);
        expect(notice).toBeTruthy();
        expect(notice.sourceText).toMatch(/60 days/i);
    });

    it('keeps multiple gross salary occurrences for annexure tables', async () => {
        const doc = await PDFDocument.create();
        const page = doc.addPage();
        const font = await doc.embedFont(StandardFonts.Helvetica);
        page.drawText('Gross Salary 16,667 2,00,004', { x: 72, y: 700, size: 12, font });
        page.drawText('Gross Salary 47,000 5,64,000', { x: 72, y: 650, size: 12, font });
        const buffer = Buffer.from(await doc.save());
        const items = await extractPdfTextItems(buffer);
        const { detections } = detectPdfFields(items);
        const gross = detections.filter((d) => d.placeholderToken === 'grossSalary');
        expect(gross.length).toBeGreaterThanOrEqual(2);
    });

    it('only detects fields present in the PDF (optional fields)', async () => {
        const doc = await PDFDocument.create();
        const page = doc.addPage();
        const font = await doc.embedFont(StandardFonts.Helvetica);
        page.drawText('Name: ABC', { x: 72, y: 700, size: 12, font });
        page.drawText('Email: abc@gmail.com', { x: 72, y: 680, size: 12, font });
        page.drawText('Position: Web Intern', { x: 72, y: 660, size: 12, font });
        const buffer = Buffer.from(await doc.save());
        const items = await extractPdfTextItems(buffer);
        const { detections } = detectPdfFields(items);
        expect(detections.find((d) => d.placeholderToken === 'candidateName')).toBeTruthy();
        expect(detections.find((d) => d.placeholderToken === 'email')).toBeFalsy();
        expect(detections.find((d) => d.placeholderToken === 'position')).toBeTruthy();
        expect(detections.find((d) => d.placeholderToken === 'phone')).toBeFalsy();
        expect(detections.find((d) => d.placeholderToken === 'gratuity')).toBeFalsy();
    });

    it('Test 1 — notice prose maps tight bbox for "60 days" only', async () => {
        const doc = await PDFDocument.create();
        const page = doc.addPage();
        const font = await doc.embedFont(StandardFonts.Helvetica);
        const prefix = 'After completion of your probation period, you will have a notice period of ';
        const suffix = '.';
        page.drawText(prefix, { x: 90, y: 692, size: 11, font });
        const valueX = 90 + font.widthOfTextAtSize(prefix, 11);
        page.drawText('60 days', { x: valueX, y: 692, size: 11, font });
        page.drawText(suffix, { x: valueX + font.widthOfTextAtSize('60 days', 11), y: 692, size: 11, font });
        const buffer = Buffer.from(await doc.save());
        const items = await extractPdfTextItems(buffer);
        const { detections } = detectPdfFields(items);
        const notice = detections.find((d) => d.placeholderToken === 'noticePeriod');
        expect(notice).toBeTruthy();
        expect(notice.sourceText).toBe('60 days');
        expect(notice.width).toBeLessThan(80);
        expect(notice.x).toBeGreaterThan(valueX - 5);
    });

    it('Test 1b — single-item notice sentence still maps tight "60 days" bbox', async () => {
        const sentence = 'After completion of your probation period, you will have a notice period of 60 days.';
        const doc = await PDFDocument.create();
        const page = doc.addPage();
        const font = await doc.embedFont(StandardFonts.Helvetica);
        page.drawText(sentence, { x: 90.02, y: 692.38, size: 11, font });
        const buffer = Buffer.from(await doc.save());
        const items = await extractPdfTextItems(buffer);
        const { detections } = detectPdfFields(items);
        const notice = detections.find((d) => d.placeholderToken === 'noticePeriod');
        expect(notice).toBeTruthy();
        expect(notice.sourceText).toBe('60 days');
        expect(notice.width).toBeLessThan(80);
        expect(notice.width).toBeLessThan(370);
    });

    it('Test 2 — Dear Rohan Sharma maps name only', async () => {
        const doc = await PDFDocument.create();
        const page = doc.addPage();
        const font = await doc.embedFont(StandardFonts.Helvetica);
        page.drawText('Dear Rohan Sharma,', { x: 72, y: 700, size: 12, font });
        const buffer = Buffer.from(await doc.save());
        const items = await extractPdfTextItems(buffer);
        const { detections } = detectPdfFields(items);
        const name = detections.find((d) => d.placeholderToken === 'candidateName');
        expect(name).toBeTruthy();
        expect(name.sourceText).toBe('Rohan Sharma');
        expect(name.width).toBeLessThan(font.widthOfTextAtSize('Dear Rohan Sharma,', 12) - 10);
    });

    it('Test 3 — salary table does not create candidateName on deductions row', async () => {
        const doc = await PDFDocument.create();
        const page = doc.addPage();
        const font = await doc.embedFont(StandardFonts.Helvetica);
        page.drawText('Total Deductions', { x: 72, y: 640, size: 11, font });
        page.drawText('2,820', { x: 200, y: 640, size: 11, font });
        page.drawText('33,840', { x: 280, y: 640, size: 11, font });
        const buffer = Buffer.from(await doc.save());
        const items = await extractPdfTextItems(buffer);
        const { detections } = detectPdfFields(items);
        expect(detections.some((d) => d.placeholderToken === 'candidateName')).toBe(false);
        expect(detections.find((d) => d.placeholderToken === 'totalDeductions')?.sourceText).toMatch(/2,820/);
        expect(detections.find((d) => d.placeholderToken === 'totalDeductionsAnnual')?.sourceText).toMatch(/33,840/);
    });

    it('Test 4 — company letterhead is not dynamically mapped', async () => {
        const doc = await PDFDocument.create();
        const page = doc.addPage();
        const font = await doc.embedFont(StandardFonts.Helvetica);
        page.drawText('PAARSIV TECHNOLOGIES PRIVATE LIMITED', { x: 72, y: 720, size: 12, font });
        page.drawText('Candidate Name: Rohan Sharma', { x: 72, y: 680, size: 12, font });
        page.drawText('Position: Engineer', { x: 72, y: 660, size: 12, font });
        const buffer = Buffer.from(await doc.save());
        const items = await extractPdfTextItems(buffer);
        const { detections } = detectPdfFields(items);
        expect(detections.some((d) => d.placeholderToken === 'companyName')).toBe(false);
        expect(detections.some((d) => (
            d.placeholderToken === 'candidateName' && /PAARSIV|TECHNOLOGIES/i.test(d.sourceText)
        ))).toBe(false);
        expect(detections.some((d) => d.sourceText === 'Rohan Sharma')).toBe(true);
    });

    it('Test 5 — joining date prose maps date substring only', async () => {
        const doc = await PDFDocument.create();
        const page = doc.addPage();
        const font = await doc.embedFont(StandardFonts.Helvetica);
        const prefix = 'Your date of joining is ';
        page.drawText(prefix, { x: 72, y: 700, size: 12, font });
        const dateX = 72 + font.widthOfTextAtSize(prefix, 12);
        page.drawText('1st September 2026.', { x: dateX, y: 700, size: 12, font });
        const buffer = Buffer.from(await doc.save());
        const items = await extractPdfTextItems(buffer);
        const { detections } = detectPdfFields(items);
        const start = detections.find((d) => d.placeholderToken === 'startDate');
        expect(start).toBeTruthy();
        expect(start.sourceText).toMatch(/1st September 2026/i);
        expect(start.width).toBeLessThan(150);
        expect(start.x).toBeGreaterThan(dateX - 5);
    });

    it('Test 6 — notice replacement preserves surrounding prose', async () => {
        const doc = await PDFDocument.create();
        const page = doc.addPage();
        const font = await doc.embedFont(StandardFonts.Helvetica);
        const prefix = 'After completion of your probation period, you will have a notice period of ';
        page.drawText(prefix, { x: 90, y: 692, size: 11, font });
        const valueX = 90 + font.widthOfTextAtSize(prefix, 11);
        page.drawText('60 days', { x: valueX, y: 692, size: 11, font });
        page.drawText('.', { x: valueX + font.widthOfTextAtSize('60 days', 11), y: 692, size: 11, font });
        const buffer = Buffer.from(await doc.save());
        const items = await extractPdfTextItems(buffer);
        const { detections } = detectPdfFields(items);
        const noticeDet = detections.find((d) => d.placeholderToken === 'noticePeriod');
        expect(noticeDet).toBeTruthy();
        expect(noticeDet.sourceText).toBe('60 days');
        expect(noticeDet.x).toBeGreaterThan(valueX - 5);
        const mapping = normalizeSavedMapping(noticeDet, items);
        expect(mapping).toBeTruthy();

        const filled = await fillPdfTemplateMappings({
            templatePdfBytes: buffer,
            mappings: [mapping],
            placeholderMap: { '{{noticePeriod}}': '90 days' },
            extractedTextItems: items,
        });
        const joined = (await extractPdfTextItems(filled)).map((i) => i.text).join(' ');
        expect(joined).toMatch(/notice period of/i);
        expect(joined).toMatch(/90/);
        expect(joined).not.toMatch(/90 days mpletion/i);
        expect(joined).toMatch(/completion of your probation/i);
    });

    it('detects quoted position title including quote marks', async () => {
        const doc = await PDFDocument.create();
        const page = doc.addPage();
        const font = await doc.embedFont(StandardFonts.Helvetica);
        page.drawText('I am pleased to offer you the position of "Web Intern" at Jaipur.', {
            x: 72, y: 700, size: 12, font,
        });
        const buffer = Buffer.from(await doc.save());
        const items = await extractPdfTextItems(buffer);
        const { detections } = detectPdfFields(items);
        const position = detections.find((d) => d.placeholderToken === 'position');
        expect(position).toBeTruthy();
        expect(position.sourceText).toMatch(/^"Web Intern"$/);
    });

    it('CTC words replacement left-aligns without gap before per annum', async () => {
        const doc = await PDFDocument.create();
        const page = doc.addPage();
        const font = await doc.embedFont(StandardFonts.Helvetica);
        const prefix = 'We are offering you a CTC of ';
        page.drawText(prefix, { x: 72, y: 700, size: 11, font });
        const wordsX = 72 + font.widthOfTextAtSize(prefix, 11);
        const original = 'Rupees Six Lakh Twenty Thousand Only';
        page.drawText(original, { x: wordsX, y: 700, size: 11, font });
        page.drawText(' per annum, as per Annexure B below.', {
            x: wordsX + font.widthOfTextAtSize(original, 11), y: 700, size: 11, font,
        });
        const buffer = Buffer.from(await doc.save());
        const items = await extractPdfTextItems(buffer);
        const { detections } = detectPdfFields(items);
        const wordsDet = detections.find((d) => d.placeholderToken === 'salaryWords');
        expect(wordsDet).toBeTruthy();
        const mapping = normalizeSavedMapping(wordsDet, items);
        expect(mapping.x).toBeCloseTo(wordsX, 0);

        const filled = await fillPdfTemplateMappings({
            templatePdfBytes: buffer,
            mappings: [mapping],
            placeholderMap: { '{{salaryWords}}': 'Rupees Two Lakh Only' },
            extractedTextItems: items,
        });
        const filledItems = await extractPdfTextItems(filled);
        const lineText = filledItems.map((i) => i.text).join(' ');
        expect(lineText).toMatch(/CTC of.*Rupees Two Lakh Only/i);
        expect(lineText).not.toMatch(/Onlyper/i);
    });

    it('Dear shorter name hugs comma without large gap', async () => {
        const doc = await PDFDocument.create();
        const page = doc.addPage();
        const font = await doc.embedFont(StandardFonts.Helvetica);
        page.drawText('Dear ', { x: 72, y: 700, size: 12, font });
        const nameX = 72 + font.widthOfTextAtSize('Dear ', 12);
        page.drawText('Alexander Johnson', { x: nameX, y: 700, size: 12, font });
        page.drawText(',', {
            x: nameX + font.widthOfTextAtSize('Alexander Johnson', 12), y: 700, size: 12, font,
        });
        const buffer = Buffer.from(await doc.save());
        const items = await extractPdfTextItems(buffer);
        const { detections } = detectPdfFields(items);
        const nameDet = detections.find((d) => d.placeholderToken === 'candidateName');
        expect(nameDet?.sourceText).toBe('Alexander Johnson');
        const mapping = normalizeSavedMapping(nameDet, items);

        const filled = await fillPdfTemplateMappings({
            templatePdfBytes: buffer,
            mappings: [mapping],
            placeholderMap: { '{{candidateName}}': 'abc singh' },
            extractedTextItems: items,
        });
        const { boundingBoxForMapping } = await import('../../helpers/pdfTemplateFiller.js');
        const box = boundingBoxForMapping(mapping, 'abc singh', font, 12);
        // Left-anchored at original name x — no gap after Dear
        expect(box.drawX).toBe(mapping.x);
        expect(box.coverWidth).toBeGreaterThan(box.textWidth);
        const joined = (await extractPdfTextItems(filled)).map((i) => i.text).join(' ');
        expect(joined).toMatch(/abc singh/i);
        expect(joined).toMatch(/Dear/i);
    });
});

describe('PDF date formatting', () => {
    it('formats dates professionally for PDF output with ordinal day', () => {
        const formatted = formatOfferDateProfessional(new Date('2026-08-05'));
        expect(formatted).toBe('5th August 2026');
    });

    it('applyPdfDateFormatting only changes date tokens', () => {
        const map = {
            '{{candidateName}}': 'Megha',
            '{{startDate}}': '5/8/2026',
        };
        const result = applyPdfDateFormatting(map, {
            startDate: new Date('2026-08-05'),
        });
        expect(result['{{candidateName}}']).toBe('Megha');
        expect(result['{{startDate}}']).toBe('5th August 2026');
    });
});
