/**
 * Fresh production-path PDF fill verification.
 * Run: node scripts/verifyPdfTemplateFill.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { createCanvas } from '@napi-rs/canvas';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { fillPdfTemplateMappings, adaptReplacementToSource } from '../helpers/pdfTemplateFiller.js';
import { extractPdfTextItems } from '../helpers/pdfTextExtractor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '../uploads/lifecycle-letters/_verify');

async function buildTemplate() {
    const doc = await PDFDocument.create();
    const page = doc.addPage([595, 842]);
    const font = await doc.embedFont(StandardFonts.TimesRoman);
    const size = 11;
    const black = rgb(0, 0, 0);

    page.drawText('Dear ', { x: 72, y: 780, size, font, color: black });
    page.drawText('abc singh', { x: 98, y: 780, size, font, color: black });
    page.drawText(',', { x: 98 + font.widthOfTextAtSize('abc singh', size), y: 780, size, font, color: black });

    page.drawText('We are pleased to offer you the position of ', { x: 72, y: 760, size, font, color: black });
    const posX = 72 + font.widthOfTextAtSize('We are pleased to offer you the position of ', size);
    page.drawText('Intern', { x: posX, y: 760, size, font, color: black });
    page.drawText('.', { x: posX + font.widthOfTextAtSize('Intern', size), y: 760, size, font, color: black });

    page.drawText('Your date of joining is ', { x: 72, y: 740, size, font, color: black });
    const dateX = 72 + font.widthOfTextAtSize('Your date of joining is ', size);
    page.drawText('1st September 2026', { x: dateX, y: 740, size, font, color: black });
    page.drawText('.', { x: dateX + font.widthOfTextAtSize('1st September 2026', size), y: 740, size, font, color: black });

    page.drawText('Your notice period will be ', { x: 72, y: 720, size, font, color: black });
    const noticeX = 72 + font.widthOfTextAtSize('Your notice period will be ', size);
    page.drawText('60', { x: noticeX, y: 720, size, font, color: black });
    page.drawText(' days from the date of resignation.', {
        x: noticeX + font.widthOfTextAtSize('60', size), y: 720, size, font, color: black,
    });

    page.drawText('Upon completion of your probation period, you will have a notice period of 60 days.', {
        x: 72, y: 700, size, font, color: black,
    });
    page.drawText('Probation Period: ', { x: 72, y: 682, size, font, color: black });
    const probX = 72 + font.widthOfTextAtSize('Probation Period: ', size);
    page.drawText('6 Months', { x: probX, y: 682, size, font, color: black });

    page.drawText('CTC of ', { x: 72, y: 660, size, font, color: black });
    const wordsX = 72 + font.widthOfTextAtSize('CTC of ', size);
    page.drawText('Rupees Six Lakh Twenty Thousand Only', { x: wordsX, y: 660, size, font, color: black });
    page.drawText(' per annum.', {
        x: wordsX + font.widthOfTextAtSize('Rupees Six Lakh Twenty Thousand Only', size),
        y: 660, size, font, color: black,
    });

    page.drawText('Annual CTC: ', { x: 72, y: 640, size, font, color: black });
    const ctcX = 72 + font.widthOfTextAtSize('Annual CTC: ', size);
    page.drawText('6,20,000', { x: ctcX, y: 640, size, font, color: black });

    page.drawText('Basic Salary', { x: 72, y: 610, size, font, color: black });
    page.drawText('25,000', { x: 220, y: 610, size, font, color: black });
    page.drawText('3,00,000', { x: 320, y: 610, size, font, color: black });

    page.drawRectangle({
        x: 70, y: 578, width: 400, height: 20,
        color: rgb(0.92, 0.92, 0.92), borderWidth: 0,
    });
    page.drawText('Gross Salary', { x: 72, y: 585, size, font, color: black });
    page.drawText('40,000', { x: 220, y: 585, size, font, color: black });
    page.drawText('4,80,000', { x: 320, y: 585, size, font, color: black });

    page.drawText('Company Email: hr@paarsiv.com', { x: 72, y: 550, size, font, color: black });

    const slots = {
        candidateName: { x: 98, y: 780, width: font.widthOfTextAtSize('abc singh', size), height: size, fontSize: size, sourceText: 'abc singh' },
        position: { x: posX, y: 760, width: font.widthOfTextAtSize('Intern', size), height: size, fontSize: size, sourceText: 'Intern' },
        startDate: { x: dateX, y: 740, width: font.widthOfTextAtSize('1st September 2026', size), height: size, fontSize: size, sourceText: '1st September 2026' },
        noticePeriod: { x: noticeX, y: 720, width: font.widthOfTextAtSize('60', size), height: size, fontSize: size, sourceText: '60' },
        probationPeriod: { x: probX, y: 682, width: font.widthOfTextAtSize('6 Months', size), height: size, fontSize: size, sourceText: '6 Months' },
        salaryWords: { x: wordsX, y: 660, width: font.widthOfTextAtSize('Rupees Six Lakh Twenty Thousand Only', size), height: size, fontSize: size, sourceText: 'Rupees Six Lakh Twenty Thousand Only' },
        annualCTC: { x: ctcX, y: 640, width: font.widthOfTextAtSize('6,20,000', size), height: size, fontSize: size, sourceText: '6,20,000' },
        basicMonthly: { x: 220, y: 610, width: font.widthOfTextAtSize('25,000', size), height: size, fontSize: size, sourceText: '25,000' },
    };

    return { bytes: Buffer.from(await doc.save()), slots };
}

async function renderPreview(pdfBytes, pngPath) {
    const data = Buffer.isBuffer(pdfBytes) ? new Uint8Array(pdfBytes) : pdfBytes;
    const pdf = await pdfjs.getDocument({ data, useSystemFonts: true, disableFontFace: true }).promise;
    const page = await pdf.getPage(1);
    const scale = 2.2;
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, intent: 'print' }).promise;
    fs.writeFileSync(pngPath, canvas.toBuffer('image/png'));
    await pdf.destroy();
}

async function main() {
    const { bytes: templateBytes, slots } = await buildTemplate();
    const items = await extractPdfTextItems(templateBytes);

    const mappings = [
        { placeholderToken: 'candidateName', page: 0, ...slots.candidateName },
        { placeholderToken: 'position', page: 0, ...slots.position },
        { placeholderToken: 'startDate', page: 0, ...slots.startDate },
        { placeholderToken: 'noticePeriod', page: 0, ...slots.noticePeriod },
        { placeholderToken: 'probationPeriod', page: 0, ...slots.probationPeriod },
        { placeholderToken: 'salaryWords', page: 0, ...slots.salaryWords },
        { placeholderToken: 'annualCTC', page: 0, ...slots.annualCTC },
        { placeholderToken: 'basicSalary', page: 0, ...slots.basicMonthly },
        // Bad mappings that must be skipped
        {
            placeholderToken: 'candidateName',
            sourceText: '25,000',
            page: 0,
            x: slots.basicMonthly.x,
            y: slots.basicMonthly.y,
            width: slots.basicMonthly.width,
            height: 11,
            fontSize: 11,
        },
        {
            placeholderToken: 'probationPeriod',
            sourceText: 'Upon completion of your probation period, you will have',
            page: 0,
            x: 72,
            y: 700,
            width: 220,
            height: 11,
            fontSize: 11,
        },
    ];

    const placeholderMap = {
        '{{candidateName}}': 'Megha Pandya',
        '{{position}}': 'MERN Stack Developer',
        '{{startDate}}': '15th September 2026',
        '{{noticePeriod}}': '90 days',
        '{{probationPeriod}}': '3 Months',
        '{{salaryWords}}': 'Rupees Two Lakh Only',
        '{{annualCTC}}': '2,00,000',
        '{{basicSalary}}': '30,000',
    };

    console.log('adapt notice:', adaptReplacementToSource('60', '90 days'));

    const filled = await fillPdfTemplateMappings({
        templatePdfBytes: templateBytes,
        mappings,
        placeholderMap,
        extractedTextItems: items,
    });

    fs.mkdirSync(outDir, { recursive: true });
    const stamp = Date.now();
    const outPdf = path.join(outDir, `fresh-fill-${stamp}.pdf`);
    const outPng = path.join(outDir, `fresh-fill-${stamp}.png`);
    fs.writeFileSync(outPdf, filled);
    await renderPreview(filled, outPng);

    const joined = (await extractPdfTextItems(filled)).map((i) => i.text).join(' ');
    const checks = {
        adaptNotice: adaptReplacementToSource('60', '90 days') === '90',
        hasMegha: /Megha/.test(joined),
        noNameInSalary: !/Basic Salary[\s\S]{0,20}Megha/i.test(joined),
        hasNotice90: /\b90\b/.test(joined),
        noDoubleDays: !/90 days days/i.test(joined),
        completionIntact: /completion of your probation/i.test(joined),
        noDaysPletion: !/dayspletion/i.test(joined),
        hasProbation3: /3\s*Months/i.test(joined),
        hasTwoLakh: /Two Lakh/i.test(joined),
        hasPerAnnum: /per annum/i.test(joined),
        hasBasic30000: /30,000/.test(joined),
        companyEmailStatic: /hr@paarsiv\.com/i.test(joined),
        outPdf,
        outPng,
    };
    console.log(JSON.stringify(checks, null, 2));
    const failed = Object.entries(checks).filter(([k, v]) => k.startsWith('out') ? false : v !== true);
    if (failed.length) {
        console.error('FAILED', failed);
        process.exitCode = 1;
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
