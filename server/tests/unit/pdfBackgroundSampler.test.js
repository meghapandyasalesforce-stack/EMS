import { describe, it, expect } from '@jest/globals';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import {
    averageRgbFromImageData,
    sanitizeSampledBackground,
    pickBestBackgroundSample,
} from '../../helpers/pdfBackgroundSampler.js';
import {
    fillPdfTemplateMappings,
    adaptReplacementToSource,
    isIncoherentPdfMapping,
    boundingBoxForMapping,
    resolveProseDrawPlan,
} from '../../helpers/pdfTemplateFiller.js';
import {
    assessPdfMappingSafety,
    isProbationProseCorruptionSource,
} from '../../helpers/pdfMappingSafety.js';
import { extractPdfTextItems } from '../../helpers/pdfTextExtractor.js';
import { buildItemKey, normalizeSavedMapping } from '../../helpers/pdfPlaceholderMappings.js';
import { detectPdfFields } from '../../helpers/pdfFieldDetector.js';

describe('pdfBackgroundSampler', () => {
    it('averages only light pixels and ignores dark text ink', () => {
        const data = new Uint8ClampedArray([
            255, 255, 255, 255,
            255, 255, 255, 255,
            0, 0, 0, 255,
            10, 10, 10, 255,
            250, 250, 250, 255,
        ]);
        const color = averageRgbFromImageData(data);
        expect(color.r).toBeGreaterThan(0.95);
    });

    it('preserves light gray table-row backgrounds', () => {
        const cleaned = sanitizeSampledBackground({ r: 0.93, g: 0.93, b: 0.93 });
        expect(cleaned.r).toBeCloseTo(0.93, 2);
    });

    it('snaps dirty mid-gray ink contamination to white', () => {
        expect(sanitizeSampledBackground({ r: 0.75, g: 0.75, b: 0.75 })).toEqual({ r: 1, g: 1, b: 1 });
    });

    it('prefers neutral gray over strongly chromatic header tint when both present', () => {
        const picked = pickBestBackgroundSample([
            { r: 0.75, g: 0.9, b: 0.75 },
            { r: 0.93, g: 0.93, b: 0.93 },
        ]);
        const chroma = Math.max(picked.r, picked.g, picked.b) - Math.min(picked.r, picked.g, picked.b);
        expect(chroma).toBeLessThan(0.1);
    });
});

describe('adaptReplacementToSource', () => {
    it('keeps only the number when source is a bare number', () => {
        expect(adaptReplacementToSource('60', '90 days')).toBe('90');
        expect(adaptReplacementToSource('30', '60 days')).toBe('60');
    });

    it('keeps unit form when source includes days', () => {
        expect(adaptReplacementToSource('60 days', '90 days')).toBe('90 days');
    });

    it('strips Rs prefix when source is bare currency digits', () => {
        expect(adaptReplacementToSource('25,000', 'Rs 30,000')).toBe('30,000');
    });
});

describe('pdf mapping safety', () => {
    it('flags candidateName on salary cells / labels', () => {
        expect(isIncoherentPdfMapping({
            placeholderToken: 'candidateName',
            sourceText: '16,667',
        })).toBe(true);
        expect(isIncoherentPdfMapping({
            placeholderToken: 'candidateName',
            sourceText: 'Basic Salary',
        })).toBe(true);
        expect(isIncoherentPdfMapping({
            placeholderToken: 'candidateName',
            sourceText: 'Fixed Total CTC',
        })).toBe(true);
        expect(isIncoherentPdfMapping({
            placeholderToken: 'candidateName',
            sourceText: 'Components',
        })).toBe(true);
    });

    it('allows normal candidateName mappings', () => {
        expect(isIncoherentPdfMapping({
            placeholderToken: 'candidateName',
            sourceText: 'abc singh',
        })).toBe(false);
    });

    it('skips candidateName when left context is a salary row', () => {
        const mapping = {
            placeholderToken: 'candidateName',
            sourceText: 'John Sample',
            page: 0,
            x: 200,
            y: 100,
            width: 80,
            height: 12,
        };
        const items = [
            { text: 'Gross Salary', page: 0, x: 72, y: 100, width: 60, height: 12 },
            { text: 'John Sample', page: 0, x: 200, y: 100, width: 80, height: 12 },
        ];
        expect(assessPdfMappingSafety(mapping, items).incoherent).toBe(true);
    });

    it('flags probationPeriod on completion prose', () => {
        expect(isProbationProseCorruptionSource('Upon completion of your probation period')).toBe(true);
        expect(isIncoherentPdfMapping({
            placeholderToken: 'probationPeriod',
            sourceText: 'Upon completion of your probation period, you will have',
        })).toBe(true);
    });

    it('allows probationPeriod on duration values', () => {
        expect(isIncoherentPdfMapping({
            placeholderToken: 'probationPeriod',
            sourceText: '6 Months',
        })).toBe(false);
        expect(isIncoherentPdfMapping({
            placeholderToken: 'probationPeriod',
            sourceText: '90 days',
        })).toBe(false);
    });

    it('flags probationPeriod duration at line start of completion sentence', () => {
        const line = '1. Upon completion of your probation period, you will have a notice period of 60 days.';
        const items = [
            { text: '1.', page: 0, x: 72, y: 700, width: 10, height: 11 },
            { text: 'Upon completion of your probation period, you will have a notice period of 60 days.', page: 0, x: 85, y: 700, width: 400, height: 11 },
        ];
        const mapping = {
            placeholderToken: 'probationPeriod',
            sourceText: '15 days',
            page: 0,
            x: 72,
            y: 700,
            width: 40,
            height: 11,
        };
        expect(assessPdfMappingSafety(mapping, items).incoherent).toBe(true);
        expect(line).toMatch(/completion of your probation/i);
    });

    it('flags noticePeriod duration at line start of completion sentence', () => {
        const items = [
            { text: '1.', page: 0, x: 72, y: 700, width: 10, height: 11 },
            { text: 'Upon completion of your probation period, you will have a notice period of 60 days.', page: 0, x: 85, y: 700, width: 400, height: 11 },
        ];
        const mapping = {
            placeholderToken: 'noticePeriod',
            sourceText: '15 days',
            page: 0,
            x: 72,
            y: 700,
            width: 40,
            height: 11,
        };
        expect(assessPdfMappingSafety(mapping, items).incoherent).toBe(true);
    });

    it('allows noticePeriod on the number after "notice period of"', () => {
        const items = [
            { text: '1. Upon completion of your probation period, you will have a notice period of', page: 0, x: 72, y: 700, width: 380, height: 11 },
            { text: '60', page: 0, x: 452, y: 700, width: 12, height: 11 },
            { text: 'days.', page: 0, x: 466, y: 700, width: 24, height: 11 },
        ];
        const mapping = {
            placeholderToken: 'noticePeriod',
            sourceText: '60',
            page: 0,
            x: 452,
            y: 700,
            width: 12,
            height: 11,
        };
        expect(assessPdfMappingSafety(mapping, items).incoherent).toBe(false);
    });

    it('flags inflated noticePeriod bbox covering full sentence', () => {
        expect(assessPdfMappingSafety({
            placeholderToken: 'noticePeriod',
            sourceText: '60 days',
            page: 0,
            x: 90,
            y: 692,
            width: 370,
            height: 11,
        }).incoherent).toBe(true);
    });

    it('rejects candidateName annexure fragment "tal Deductions 2,820 33,840"', () => {
        expect(assessPdfMappingSafety({
            placeholderToken: 'candidateName',
            sourceText: 'tal Deductions 2,820 33,840',
            page: 0,
            x: 54,
            y: 640,
            width: 426,
            height: 11,
        }).incoherent).toBe(true);
    });
});

describe('pdfTemplateFiller seamless replacement', () => {
    it('replaces long values without leaving original sample text alone', async () => {
        const doc = await PDFDocument.create();
        const page = doc.addPage([595, 842]);
        const font = await doc.embedFont(StandardFonts.Helvetica);
        page.drawText('Name: abc', { x: 72, y: 700, size: 12, font, color: rgb(0, 0, 0) });
        const buffer = Buffer.from(await doc.save());

        const items = await extractPdfTextItems(buffer);
        const nameItem = items.find((i) => i.text.includes('abc'));
        const mapping = normalizeSavedMapping({
            placeholderToken: 'candidateName',
            itemKey: buildItemKey(nameItem),
            sourceText: 'abc',
        }, items);

        const filled = await fillPdfTemplateMappings({
            templatePdfBytes: buffer,
            mappings: [mapping],
            placeholderMap: { '{{candidateName}}': 'Megha Pandya' },
            extractedTextItems: items,
        });

        const joined = (await extractPdfTextItems(filled)).map((i) => i.text).join(' ');
        expect(joined).toMatch(/Megha/);
    });

    it('skips candidateName mapped to a salary cell at generation time', async () => {
        const doc = await PDFDocument.create();
        const page = doc.addPage([595, 842]);
        const font = await doc.embedFont(StandardFonts.Helvetica);
        page.drawText('Basic Salary  25,000', { x: 72, y: 700, size: 12, font });
        const buffer = Buffer.from(await doc.save());
        const items = await extractPdfTextItems(buffer);

        const filled = await fillPdfTemplateMappings({
            templatePdfBytes: buffer,
            mappings: [{
                placeholderToken: 'candidateName',
                sourceText: '25,000',
                page: 0,
                x: 160,
                y: 700,
                width: 40,
                height: 12,
                fontSize: 12,
            }],
            placeholderMap: { '{{candidateName}}': 'Megha Pandya' },
            extractedTextItems: items,
        });

        const joined = (await extractPdfTextItems(filled)).map((i) => i.text).join(' ');
        expect(joined).not.toMatch(/Megha/);
        expect(joined).toMatch(/25/);
    });

    it('skips probationPeriod mapped onto completion prose', async () => {
        const doc = await PDFDocument.create();
        const page = doc.addPage([595, 842]);
        const font = await doc.embedFont(StandardFonts.Helvetica);
        page.drawText('Upon completion of your probation period, you will have a notice period of 60 days.', {
            x: 72, y: 700, size: 11, font,
        });
        const buffer = Buffer.from(await doc.save());
        const items = await extractPdfTextItems(buffer);

        const filled = await fillPdfTemplateMappings({
            templatePdfBytes: buffer,
            mappings: [{
                placeholderToken: 'probationPeriod',
                sourceText: 'Upon completion of your probation period, you will have',
                page: 0,
                x: 72,
                y: 700,
                width: 200,
                height: 12,
                fontSize: 11,
            }],
            placeholderMap: { '{{probationPeriod}}': '15 days' },
            extractedTextItems: items,
        });

        const joined = (await extractPdfTextItems(filled)).map((i) => i.text).join(' ');
        expect(joined).toMatch(/completion of your probation/i);
        expect(joined).not.toMatch(/15 dayspletion/i);
    });

    it('skips probationPeriod "15 days" at line start of numbered completion sentence', async () => {
        const doc = await PDFDocument.create();
        const page = doc.addPage([595, 842]);
        const font = await doc.embedFont(StandardFonts.Helvetica);
        page.drawText('1. Upon completion of your probation period, you will have a notice period of 60 days.', {
            x: 72, y: 700, size: 11, font,
        });
        const buffer = Buffer.from(await doc.save());
        const items = await extractPdfTextItems(buffer);

        const filled = await fillPdfTemplateMappings({
            templatePdfBytes: buffer,
            mappings: [{
                placeholderToken: 'probationPeriod',
                sourceText: '15 days',
                page: 0,
                x: 72,
                y: 700,
                width: font.widthOfTextAtSize('15 days', 11),
                height: 11,
                fontSize: 11,
            }],
            placeholderMap: { '{{probationPeriod}}': '15 days' },
            extractedTextItems: items,
        });

        const joined = (await extractPdfTextItems(filled)).map((i) => i.text).join(' ');
        expect(joined).toMatch(/Upon completion of your probation/i);
        expect(joined).not.toMatch(/15 days\s*mpletion/i);
    });

    it('updates notice period in completion sentence when mapped to 60', async () => {
        const doc = await PDFDocument.create();
        const page = doc.addPage([595, 842]);
        const font = await doc.embedFont(StandardFonts.Helvetica);
        const prefix = '1. Upon completion of your probation period, you will have a notice period of ';
        page.drawText(prefix, { x: 72, y: 700, size: 11, font });
        const numX = 72 + font.widthOfTextAtSize(prefix, 11);
        page.drawText('60', { x: numX, y: 700, size: 11, font });
        page.drawText(' days.', { x: numX + font.widthOfTextAtSize('60', 11), y: 700, size: 11, font });
        const buffer = Buffer.from(await doc.save());
        const items = await extractPdfTextItems(buffer);

        const filled = await fillPdfTemplateMappings({
            templatePdfBytes: buffer,
            mappings: [{
                placeholderToken: 'noticePeriod',
                sourceText: '60',
                page: 0,
                x: numX,
                y: 700,
                width: font.widthOfTextAtSize('60', 11),
                height: 11,
                fontSize: 11,
            }],
            placeholderMap: { '{{noticePeriod}}': '90 days' },
            extractedTextItems: items,
        });

        const joined = (await extractPdfTextItems(filled)).map((i) => i.text).join(' ');
        expect(joined).toMatch(/90/);
        expect(joined).toMatch(/Upon completion of your probation/i);
    });

    it('left-anchors shorter salaryWords at saved mapping.x; flows per annum after value', async () => {
        const font = await (await PDFDocument.create()).embedFont(StandardFonts.TimesRoman);
        const mapping = {
            placeholderToken: 'salaryWords',
            x: 118.69,
            y: 537.77,
            width: 193.13,
            height: 11.04,
            sourceText: 'Rupees Six Lakh Twenty Thousand Only',
        };
        const items = [
            { text: 'CTC of Rupees Six Lakh Twenty Thousand Only', page: 0, x: 81.14, y: 537.77, width: 230.68 },
            { text: 'per annum, as per Annexure B below.', page: 0, x: 315, y: 537.77, width: 166.55 },
        ];
        const box = resolveProseDrawPlan(mapping, 'Rupees Two Lakh Only', font, 11.04, items);
        expect(box.drawX).toBe(mapping.x);
        expect(box.value).toMatch(/^Rupees Two Lakh Only per annum/i);
        expect(box.value).not.toMatch(/Onlyper/i);
        expect(box.coverX + box.coverWidth).toBeGreaterThan(315);
    });

    it('left-anchors shorter quoted position at quote-item x (no gap before closing quote)', async () => {
        const font = await (await PDFDocument.create()).embedFont(StandardFonts.TimesRoman);
        const mapping = {
            placeholderToken: 'position',
            x: 440.33,
            y: 562.73,
            width: 98.59,
            height: 11.04,
            sourceText: '“Software Engineer”',
        };
        const items = [
            { text: ', I am pleased to offer you the position of', page: 0, x: 255.7, y: 562.73, width: 181.55 },
            { text: '“Software Engineer”', page: 0, x: 440.33, y: 562.73, width: 98.59 },
        ];
        const box = resolveProseDrawPlan(mapping, '“Web Intern”', font, 11.04, items);
        expect(box.drawX).toBe(440.33);
        expect(box.value).toBe('“Web Intern”');
        expect(box.coverWidth).toBeGreaterThan(box.textWidth);
    });

    it('candidateName covers full Dear-line and redraws Bold Dear + name+comma', async () => {
        const doc = await PDFDocument.create();
        const font = await doc.embedFont(StandardFonts.TimesRoman);
        const fonts = { timesBold: await doc.embedFont(StandardFonts.TimesRomanBold) };
        const mapping = {
            placeholderToken: 'candidateName',
            x: 81.64,
            y: 596.83,
            width: 66.28,
            height: 11.04,
            sourceText: 'Rohan Sharma',
        };
        const items = [
            { text: 'Dear Rohan Sharma,', page: 0, x: 54.02, y: 596.83, width: 99.42 },
        ];
        const box = resolveProseDrawPlan(mapping, 'abc singh', font, 11.04, items, fonts);
        expect(box.prefixText).toMatch(/^Dear\s+$/i);
        expect(box.value).toBe('abc singh,');
        expect(box.coverX).toBeLessThanOrEqual(54.02);
        expect(box.drawX).toBeGreaterThan(54.02);
        expect(box.coverX + box.coverWidth).toBeGreaterThan(54.02 + 99.42 - 2);
    });

    it('regression — Dear / position / salaryWords stay left-anchored via neighbors', async () => {
        const doc = await PDFDocument.create();
        const font = await doc.embedFont(StandardFonts.TimesRoman);
        const fonts = { timesBold: await doc.embedFont(StandardFonts.TimesRomanBold) };
        const nameBox = resolveProseDrawPlan({
            placeholderToken: 'candidateName',
            x: 81.64,
            y: 596.83,
            width: 66.28,
            height: 11.04,
            sourceText: 'Rohan Sharma',
        }, 'Amit', font, 11.04, [
            { text: 'Dear Rohan Sharma,', page: 0, x: 54.02, y: 596.83, width: 99.42 },
        ], fonts);
        const posBox = resolveProseDrawPlan({
            placeholderToken: 'position',
            x: 440.33,
            y: 562.73,
            width: 98.59,
            height: 11.04,
            sourceText: '“Software Engineer”',
        }, '“Web Intern”', font, 11.04, [
            { text: '“Software Engineer”', page: 0, x: 440.33, y: 562.73, width: 98.59 },
        ]);
        const wordsBox = resolveProseDrawPlan({
            placeholderToken: 'salaryWords',
            x: 118.69,
            y: 537.77,
            width: 193.13,
            height: 11.04,
            sourceText: 'Rupees Six Lakh Twenty Thousand Only',
        }, 'Rupees Two Lakh Only', font, 11.04, [
            { text: 'per annum, as per Annexure B below.', page: 0, x: 315, y: 537.77, width: 166.55 },
        ]);
        expect(nameBox.prefixText).toMatch(/^Dear\s+/i);
        expect(nameBox.value).toMatch(/,$/);
        expect(posBox.drawX).toBe(440.33);
        expect(wordsBox.drawX).toBe(118.69);
        expect(wordsBox.value).toMatch(/^Rupees Two Lakh Only per annum/i);
        expect(wordsBox.value).not.toMatch(/Onlyper/i);
    });

    it('noticePeriod shorter replacement stays left-anchored at saved x 425.05', async () => {
        const font = await (await PDFDocument.create()).embedFont(StandardFonts.TimesRoman);
        const box = boundingBoxForMapping({
            placeholderToken: 'noticePeriod',
            x: 425.05,
            y: 692.38,
            width: 30.86,
            height: 11.04,
            sourceText: '60 days',
        }, '32 days', font, 11.04);
        expect(box.drawX).toBe(425.05);
        expect(box.coverX).toBeLessThan(425.05);
    });

    it('preserves notice-period prose when only the number is mapped', async () => {
        const doc = await PDFDocument.create();
        const page = doc.addPage([595, 842]);
        const font = await doc.embedFont(StandardFonts.Helvetica);
        page.drawText('Your notice period will be ', { x: 72, y: 700, size: 12, font });
        const numX = 72 + font.widthOfTextAtSize('Your notice period will be ', 12);
        page.drawText('60', { x: numX, y: 700, size: 12, font });
        page.drawText(' days from resignation.', {
            x: numX + font.widthOfTextAtSize('60', 12), y: 700, size: 12, font,
        });
        const buffer = Buffer.from(await doc.save());

        const filled = await fillPdfTemplateMappings({
            templatePdfBytes: buffer,
            mappings: [{
                placeholderToken: 'noticePeriod',
                sourceText: '60',
                page: 0,
                x: numX,
                y: 700,
                width: font.widthOfTextAtSize('60', 12),
                height: 12,
                fontSize: 12,
            }],
            placeholderMap: { '{{noticePeriod}}': '90 days' },
        });

        const joined = (await extractPdfTextItems(filled)).map((i) => i.text).join(' ');
        expect(joined).toMatch(/90/);
        expect(joined).not.toMatch(/90 days days/i);
        expect(joined).toMatch(/notice period will be/i);
        expect(joined).toMatch(/days from resignation/i);
    });

    it('replaces noticePeriod source "60 days" with "90 days"', async () => {
        expect(adaptReplacementToSource('60 days', '90 days')).toBe('90 days');
    });

    it('fills CTC words without drawing candidate name into salary annexure', async () => {
        const doc = await PDFDocument.create();
        const page = doc.addPage([595, 842]);
        const font = await doc.embedFont(StandardFonts.Helvetica);
        page.drawText('CTC of ', { x: 72, y: 720, size: 11, font });
        const wx = 72 + font.widthOfTextAtSize('CTC of ', 11);
        page.drawText('Rupees Six Lakh Twenty Thousand Only', { x: wx, y: 720, size: 11, font });
        page.drawText(' per annum.', {
            x: wx + font.widthOfTextAtSize('Rupees Six Lakh Twenty Thousand Only', 11),
            y: 720, size: 11, font,
        });
        page.drawText('Basic Salary', { x: 72, y: 680, size: 11, font });
        page.drawText('25,000', { x: 200, y: 680, size: 11, font });
        const buffer = Buffer.from(await doc.save());
        const items = await extractPdfTextItems(buffer);

        const filled = await fillPdfTemplateMappings({
            templatePdfBytes: buffer,
            mappings: [
                {
                    placeholderToken: 'salaryWords',
                    sourceText: 'Rupees Six Lakh Twenty Thousand Only',
                    page: 0,
                    x: wx,
                    y: 720,
                    width: font.widthOfTextAtSize('Rupees Six Lakh Twenty Thousand Only', 11),
                    height: 11,
                    fontSize: 11,
                },
                {
                    placeholderToken: 'candidateName',
                    sourceText: '25,000',
                    page: 0,
                    x: 200,
                    y: 680,
                    width: 40,
                    height: 11,
                    fontSize: 11,
                },
                {
                    placeholderToken: 'basicSalary',
                    sourceText: '25,000',
                    page: 0,
                    x: 200,
                    y: 680,
                    width: font.widthOfTextAtSize('25,000', 11),
                    height: 11,
                    fontSize: 11,
                },
            ],
            placeholderMap: {
                '{{salaryWords}}': 'Rupees Two Lakh Only',
                '{{candidateName}}': 'Megha Pandya',
                '{{basicSalary}}': '30,000',
            },
            extractedTextItems: items,
        });

        const joined = (await extractPdfTextItems(filled)).map((i) => i.text).join(' ');
        expect(joined).toMatch(/Two Lakh|Rupees/i);
        expect(joined).toMatch(/30,000/);
        expect(joined).not.toMatch(/Megha/);
        expect(joined).toMatch(/per annum/i);
        expect(joined).toMatch(/Basic Salary/i);
    });

    it('replaces shorter names without wiping Name label', async () => {
        const doc = await PDFDocument.create();
        const page = doc.addPage([595, 842]);
        const font = await doc.embedFont(StandardFonts.Helvetica);
        page.drawText('Name: Alexander Johnson', { x: 72, y: 700, size: 12, font });
        const buffer = Buffer.from(await doc.save());
        const items = await extractPdfTextItems(buffer);
        const nameItem = items.find((i) => /Alexander|Johnson/i.test(i.text));
        const mapping = normalizeSavedMapping({
            placeholderToken: 'candidateName',
            itemKey: buildItemKey(nameItem),
            sourceText: nameItem.text.includes('Alexander') ? 'Alexander Johnson' : nameItem.text,
        }, items);

        const filled = await fillPdfTemplateMappings({
            templatePdfBytes: buffer,
            mappings: [mapping],
            placeholderMap: { '{{candidateName}}': 'Raj' },
            extractedTextItems: items,
        });

        const joined = (await extractPdfTextItems(filled)).map((i) => i.text).join(' ');
        expect(joined).toMatch(/Raj/);
        expect(joined).toMatch(/Name:/);
    });
});

describe('pdfFieldDetector safety', () => {
    it('does not detect probation on completion-of-probation prose', async () => {
        const doc = await PDFDocument.create();
        const page = doc.addPage([595, 842]);
        const font = await doc.embedFont(StandardFonts.Helvetica);
        page.drawText('Upon completion of your probation period, you will have a notice period of 60 days.', {
            x: 72, y: 700, size: 11, font,
        });
        page.drawText('Probation Period: 6 Months', { x: 72, y: 670, size: 11, font });
        const buffer = Buffer.from(await doc.save());
        const items = await extractPdfTextItems(buffer);
        const { detections } = detectPdfFields(items);

        const bad = detections.filter((d) => (
            d.placeholderToken === 'probationPeriod'
            && /completion/i.test(d.sourceText || '')
        ));
        expect(bad.length).toBe(0);

        const good = detections.find((d) => (
            d.placeholderToken === 'probationPeriod'
            && /6\s*Months/i.test(d.sourceText || '')
        ));
        expect(good).toBeTruthy();

        const notice = detections.find((d) => d.placeholderToken === 'noticePeriod');
        expect(notice?.sourceText).toMatch(/60/);
    });

    it('does not detect candidateName for currency-like values', async () => {
        const doc = await PDFDocument.create();
        const page = doc.addPage([595, 842]);
        const font = await doc.embedFont(StandardFonts.Helvetica);
        page.drawText('Dear abc singh,', { x: 72, y: 720, size: 12, font });
        page.drawText('Basic Salary  25,000  3,00,000', { x: 72, y: 690, size: 11, font });
        const buffer = Buffer.from(await doc.save());
        const items = await extractPdfTextItems(buffer);
        const { detections } = detectPdfFields(items);

        expect(detections.some((d) => d.placeholderToken === 'candidateName')).toBe(true);
        expect(detections.some((d) => (
            d.placeholderToken === 'candidateName' && /25,000|Basic/i.test(d.sourceText || '')
        ))).toBe(false);
        expect(detections.some((d) => d.placeholderToken === 'basicSalary')).toBe(true);
    });
});
