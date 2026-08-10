/**
 * Renders offer/lifecycle letter HTML into a jsPDF document.
 * Used when Puppeteer/Chromium is unavailable — supports the HTML subset used by offer templates.
 */

import { jsPDF } from 'jspdf';
import { normalizeRichHtml } from './normalizeRichHtml.js';

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const DEFAULT_MARGIN = 15;

function decodeEntities(text = '') {
    let value = String(text);
    for (let i = 0; i < 5; i += 1) {
        const next = value
            .replace(/&nbsp;/gi, ' ')
            .replace(/&#160;/g, ' ')
            .replace(/&#x0*a0;/gi, ' ')
            .replace(/\u00a0/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
        if (next === value) break;
        value = next;
    }
    return value;
}

function stripTags(text = '') {
    return decodeEntities(String(text).replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

function parseAlignment(tagHtml = '') {
    const match = String(tagHtml).match(/text-align\s*:\s*(left|center|right|justify)/i);
    return match?.[1]?.toLowerCase() || 'left';
}

function parseInlineSegments(html = '') {
    const segments = [];
    const pattern = /<(b|strong|i|em|u|a)(?:\s[^>]*)?>|<\/(b|strong|i|em|u|a)>|<br\s*\/?>/gi;
    let lastIndex = 0;
    let match;
    const styleStack = [{ bold: false, italic: false, underline: false }];

    const currentStyle = () => styleStack[styleStack.length - 1];

    while ((match = pattern.exec(html)) !== null) {
        if (match.index > lastIndex) {
            const text = decodeEntities(html.slice(lastIndex, match.index));
            if (text) segments.push({ text, ...currentStyle() });
        }

        const tag = (match[1] || match[2] || '').toLowerCase();
        if (match[0].match(/^<br/i)) {
            segments.push({ text: '\n', ...currentStyle(), break: true });
        } else if (match[1]) {
            const next = { ...currentStyle() };
            if (tag === 'b' || tag === 'strong') next.bold = true;
            if (tag === 'i' || tag === 'em') next.italic = true;
            if (tag === 'u') next.underline = true;
            styleStack.push(next);
        } else {
            if (styleStack.length > 1) styleStack.pop();
        }
        lastIndex = pattern.lastIndex;
    }

    if (lastIndex < html.length) {
        const text = decodeEntities(html.slice(lastIndex));
        if (text) segments.push({ text, ...currentStyle() });
    }

    if (!segments.length && html) {
        segments.push({ text: stripTags(html), bold: false, italic: false, underline: false });
    }

    return segments;
}

function extractBlocks(html = '') {
    const blocks = [];
    let remaining = String(html || '');

    const patterns = [
        { type: 'table', regex: /<table[\s\S]*?<\/table>/gi },
        { type: 'heading', regex: /<h([1-3])[^>]*>[\s\S]*?<\/h\1>/gi },
        { type: 'list', regex: /<(ul|ol)[^>]*>[\s\S]*?<\/\1>/gi },
        { type: 'paragraph', regex: /<p[^>]*>[\s\S]*?<\/p>/gi },
        { type: 'div', regex: /<div[^>]*>[\s\S]*?<\/div>/gi },
    ];

    while (remaining.trim()) {
        let earliest = null;
        for (const pattern of patterns) {
            pattern.regex.lastIndex = 0;
            const match = pattern.regex.exec(remaining);
            if (match && (!earliest || match.index < earliest.index)) {
                earliest = { ...pattern, match };
            }
        }

        if (!earliest) {
            const text = stripTags(remaining);
            if (text) blocks.push({ type: 'text', text, align: 'left' });
            break;
        }

        if (earliest.index > 0) {
            const leading = stripTags(remaining.slice(0, earliest.index));
            if (leading) blocks.push({ type: 'text', text: leading, align: 'left' });
        }

        const tagHtml = earliest.match[0];
        if (earliest.type === 'table') {
            blocks.push({ type: 'table', html: tagHtml });
        } else if (earliest.type === 'heading') {
            const level = Number(earliest.match[1] || 2);
            blocks.push({
                type: 'heading',
                level,
                segments: parseInlineSegments(tagHtml.replace(/^<h[1-3][^>]*>|<\/h[1-3]>$/gi, '')),
                align: parseAlignment(tagHtml),
            });
        } else if (earliest.type === 'list') {
            const ordered = /^<ol/i.test(tagHtml);
            const items = [...tagHtml.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => parseInlineSegments(m[1]));
            blocks.push({ type: 'list', ordered, items });
        } else {
            blocks.push({
                type: 'paragraph',
                segments: parseInlineSegments(tagHtml.replace(/^<(p|div)[^>]*>|<\/(p|div)>$/gi, '')),
                align: parseAlignment(tagHtml),
            });
        }

        remaining = remaining.slice(earliest.index + earliest.match[0].length);
    }

    return blocks;
}

function parseTable(html = '') {
    const rows = [];
    for (const rowMatch of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
        const cells = [];
        for (const cellMatch of rowMatch[1].matchAll(/<(th|td)[^>]*>([\s\S]*?)<\/\1>/gi)) {
            cells.push({
                header: cellMatch[1].toLowerCase() === 'th',
                segments: parseInlineSegments(cellMatch[2]),
            });
        }
        if (cells.length) rows.push(cells);
    }
    return rows;
}

class LetterPdfRenderer {
    constructor(doc, { includePageNumbers = true, marginMm = DEFAULT_MARGIN, watermarkText = '' } = {}) {
        this.doc = doc;
        this.margin = marginMm;
        this.contentWidth = PAGE_WIDTH - marginMm * 2;
        this.y = marginMm;
        this.includePageNumbers = includePageNumbers;
        this.watermarkText = watermarkText;
    }

    ensureSpace(height) {
        if (this.y + height <= PAGE_HEIGHT - this.margin) return;
        this.finishPage();
        this.doc.addPage();
        this.y = this.margin;
        this.drawWatermark();
    }

    finishPage() {
        if (!this.includePageNumbers) return;
        this.doc.setFont('helvetica', 'normal');
        this.doc.setFontSize(9);
        this.doc.setTextColor(100, 100, 100);
        this.doc.text(
            `Page ${this.doc.internal.getNumberOfPages()}`,
            PAGE_WIDTH - this.margin,
            PAGE_HEIGHT - 8,
            { align: 'right' },
        );
        this.doc.setTextColor(0, 0, 0);
    }

    drawWatermark() {
        if (!this.watermarkText) return;
        this.doc.setTextColor(200, 200, 200);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setFontSize(40);
        this.doc.text(this.watermarkText, PAGE_WIDTH / 2, PAGE_HEIGHT / 2, { align: 'center', angle: 45 });
        this.doc.setTextColor(0, 0, 0);
    }

    fontStyle(segment) {
        if (segment.bold && segment.italic) return 'bolditalic';
        if (segment.bold) return 'bold';
        if (segment.italic) return 'italic';
        return 'normal';
    }

    wrapSegments(segments, fontSize, maxWidth) {
        const lines = [];
        let current = [];

        const pushLine = () => {
            if (current.length) {
                lines.push(current);
                current = [];
            }
        };

        for (const segment of segments) {
            const parts = String(segment.text).split('\n');
            parts.forEach((part, index) => {
                if (index > 0) pushLine();
                if (!part) return;
                const words = part.split(/(\s+)/);
                for (const word of words) {
                    if (!word) continue;
                    const trial = [...current, { ...segment, text: word }];
                    const width = trial.reduce((sum, s) => {
                        this.doc.setFont('helvetica', this.fontStyle(s));
                        this.doc.setFontSize(fontSize);
                        return sum + this.doc.getTextWidth(s.text);
                    }, 0);
                    if (width > maxWidth && current.length) {
                        pushLine();
                        current.push({ ...segment, text: word.trim() ? word : word });
                    } else {
                        current.push({ ...segment, text: word });
                    }
                }
            });
        }
        pushLine();
        return lines;
    }

    drawSegmentLine(segments, x, y, fontSize, align = 'left') {
        const lineWidth = segments.reduce((sum, s) => {
            this.doc.setFont('helvetica', this.fontStyle(s));
            this.doc.setFontSize(fontSize);
            return sum + this.doc.getTextWidth(s.text);
        }, 0);

        let cursorX = x;
        if (align === 'center') cursorX = x + (this.contentWidth - lineWidth) / 2;
        if (align === 'right') cursorX = x + this.contentWidth - lineWidth;

        for (const segment of segments) {
            this.doc.setFont('helvetica', this.fontStyle(segment));
            this.doc.setFontSize(fontSize);
            this.doc.text(segment.text, cursorX, y);
            cursorX += this.doc.getTextWidth(segment.text);
        }
    }

    renderSegments(segments, { fontSize = 11, align = 'left', lineHeight = 6 } = {}) {
        const lines = this.wrapSegments(segments, fontSize, this.contentWidth);
        this.ensureSpace(lines.length * lineHeight);
        for (const line of lines) {
            this.drawSegmentLine(line, this.margin, this.y, fontSize, align);
            this.y += lineHeight;
        }
    }

    renderHeading(block) {
        const size = block.level === 1 ? 18 : block.level === 2 ? 15 : 13;
        this.y += 2;
        this.renderSegments(block.segments, { fontSize: size, align: block.align, lineHeight: 7 });
        this.y += 1;
    }

    renderParagraph(block) {
        this.renderSegments(block.segments, { fontSize: 11, align: block.align, lineHeight: 6 });
        this.y += 1;
    }

    renderList(block) {
        block.items.forEach((item, index) => {
            const prefix = block.ordered ? `${index + 1}. ` : '• ';
            const segments = [{ text: prefix, bold: false, italic: false, underline: false }, ...item];
            this.renderSegments(segments, { fontSize: 11, lineHeight: 6 });
        });
        this.y += 1;
    }

    renderTable(block) {
        const rows = parseTable(block.html);
        if (!rows.length) return;

        const colCount = Math.max(...rows.map((r) => r.length));
        const colWidth = this.contentWidth / colCount;
        const rowHeight = 8;

        this.ensureSpace(rows.length * rowHeight + 4);
        for (const row of rows) {
            this.ensureSpace(rowHeight);
            let x = this.margin;
            for (let i = 0; i < colCount; i += 1) {
                const cell = row[i] || { segments: [{ text: '', bold: false, italic: false, underline: false }], header: false };
                this.doc.setDrawColor(180, 180, 180);
                this.doc.rect(x, this.y - 5, colWidth, rowHeight);
                this.doc.setFont('helvetica', cell.header ? 'bold' : 'normal');
                this.doc.setFontSize(10);
                const text = cell.segments.map((s) => s.text).join('').trim();
                const wrapped = this.doc.splitTextToSize(text, colWidth - 2);
                this.doc.text(wrapped[0] || '', x + 1.5, this.y);
                x += colWidth;
            }
            this.y += rowHeight;
        }
        this.y += 2;
    }

    renderText(text) {
        this.doc.setFont('helvetica', 'normal');
        this.doc.setFontSize(11);
        const lines = this.doc.splitTextToSize(text, this.contentWidth);
        this.ensureSpace(lines.length * 6);
        for (const line of lines) {
            this.doc.text(line, this.margin, this.y);
            this.y += 6;
        }
    }

    renderBody(html) {
        this.drawWatermark();
        const blocks = extractBlocks(normalizeRichHtml(html));
        for (const block of blocks) {
            if (block.type === 'heading') this.renderHeading(block);
            else if (block.type === 'paragraph') this.renderParagraph(block);
            else if (block.type === 'list') this.renderList(block);
            else if (block.type === 'table') this.renderTable(block);
            else this.renderText(block.text);
        }
    }
}

export function renderHtmlToPdfBufferWithJsPdf(htmlDocument, options = {}) {
    const bodyMatch = htmlDocument.match(/<div class="letter-body[^"]*">([\s\S]*?)<\/div>/i);
    const headerMatch = htmlDocument.match(/<div class="letter-header">([\s\S]*?)<\/div>/i);
    const footerMatch = htmlDocument.match(/<div class="letter-footer">([\s\S]*?)<\/div>/i);
    const watermarkMatch = htmlDocument.match(/<div class="letter-watermark">([\s\S]*?)<\/div>/i);

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const renderer = new LetterPdfRenderer(doc, {
        ...options,
        watermarkText: watermarkMatch ? stripTags(watermarkMatch[1]) : options.watermarkText,
    });

    if (headerMatch) {
        renderer.renderBody(headerMatch[1]);
        renderer.y += 2;
    }
    if (bodyMatch) renderer.renderBody(bodyMatch[1]);
    if (footerMatch) {
        renderer.y += 4;
        renderer.renderBody(footerMatch[1]);
    }

    renderer.finishPage();
    return Buffer.from(doc.output('arraybuffer'));
}

export default { renderHtmlToPdfBufferWithJsPdf };
