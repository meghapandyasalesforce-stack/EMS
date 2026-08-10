/**
 * Automatic PDF offer letter field detection using label context and text coordinates.
 * Does NOT guess fields from values alone — requires surrounding labels or strong patterns.
 */

import { OFFER_PLACEHOLDER_DEFINITIONS } from './offerPlaceholderResolver.js';
import { buildItemKey } from './pdfPlaceholderMappings.js';
import {
    assessPdfMappingSafety,
    isInvalidCandidateNameFragment,
    isProbationProseCorruptionSource,
    isStrongCandidateNameLabel,
    isValidProbationValueSource,
    looksLikePersonName,
    looksLikeSalaryComponentLabel,
    looksLikeCurrencyValue,
} from './pdfMappingSafety.js';
import { estimateSubstringBBox, isInflatedSourceBbox, findQuotedSpanInLine } from './pdfMappingGeometry.js';

export const CONFIDENCE_HIGH = 85;
export const CONFIDENCE_MEDIUM = 60;

const LABEL_BY_TOKEN = new Map(
    OFFER_PLACEHOLDER_DEFINITIONS.map((d) => [d.token, d.label]),
);

/** Known label phrases mapped to placeholder tokens. */
const FIELD_LABEL_RULES = [
    { token: 'candidateName', labels: ['name', 'candidate name', 'employee name', 'applicant name', 'full name'] },
    // Email intentionally omitted — company letterhead emails must remain static
    { token: 'phone', labels: ['phone', 'mobile', 'contact number', 'phone number', 'mobile number'] },
    { token: 'position', labels: ['position', 'designation', 'job title', 'role', 'title offered'] },
    { token: 'department', labels: ['department', 'dept', 'division'] },
    { token: 'reportingManager', labels: ['reporting manager', 'manager', 'reports to', 'supervisor', 'reporting to'] },
    {
        token: 'startDate',
        labels: [
            'joining date', 'date of joining', 'start date', 'date of join', 'doj',
            'commencement date', 'date of commencement', 'joining',
        ],
    },
    { token: 'location', labels: ['location', 'work location', 'place of work', 'job location', 'workplace', 'office location'] },
    { token: 'employmentType', labels: ['employment type', 'type of employment', 'employment status'] },
    {
        token: 'companyName',
        labels: ['company name', 'organisation name', 'organization name', 'employer name', 'company', 'employer'],
    },
    {
        token: 'annualCTC',
        labels: [
            'annual ctc', 'ctc', 'annual compensation', 'cost to company', 'annual package', 'package',
            'total annual ctc', 'total annual compensation',
        ],
    },
    { token: 'salary', labels: ['salary', 'annual salary', 'gross salary annual'] },
    { token: 'salaryWords', labels: ['in words', 'rupees only', 'amount in words', 'salary in words', 'ctc in words', 'package in words'] },
    { token: 'basicSalary', labels: ['basic salary', 'basic pay', 'basic'] },
    { token: 'hra', labels: ['hra', 'house rent allowance'] },
    { token: 'specialAllowance', labels: ['special allowance', 'special pay'] },
    { token: 'otherAllowance', labels: ['other allowance', 'other allowances', 'additional allowance'] },
    { token: 'grossSalary', labels: ['gross salary', 'gross pay', 'gross'] },
    { token: 'employeePF', labels: ['employee pf', 'employee provident fund', 'epf employee', 'epf'] },
    { token: 'employeeESI', labels: ['employee esi', 'employee esic', 'esi employee', 'esic employee'] },
    { token: 'employerPF', labels: ['employer pf', 'employer provident fund', 'epf employer'] },
    { token: 'employerESI', labels: ['employer esi', 'employer esic', 'esi employer', 'esic employer'] },
    { token: 'gratuity', labels: ['gratuity'] },
    { token: 'professionalTax', labels: ['professional tax', 'prof tax', 'pt'] },
    { token: 'tds', labels: ['tds', 'tax deducted at source', 'income tax'] },
    { token: 'totalDeductions', labels: ['total deductions', 'deductions', 'total deduction'] },
    { token: 'totalCTC', labels: ['total ctc', 'total compensation', 'total salary', 'fixed total ctc'] },
    { token: 'probationPeriod', labels: ['probation', 'probation period'] },
    { token: 'noticePeriod', labels: ['notice period', 'serving notice period', 'notice'] },
    { token: 'workingHours', labels: ['working hours', 'work hours', 'office hours'] },
    { token: 'offerDate', labels: ['offer date', 'date of offer', 'letter date', 'offer letter date'] },
    { token: 'offerExpiryDate', labels: ['offer expiry', 'valid until', 'expiry date', 'offer valid until'] },
    {
        token: 'leaveEntitlement',
        labels: [
            'leave', 'leave entitlement', 'annual leave', 'paid leave', 'casual leave',
            'sick leave', 'earned leave', 'privilege leave', 'leaves per year',
        ],
    },
];

/** Monthly salary tokens that may appear with a Per Annum column beside them. */
const ANNUAL_TOKEN_BY_MONTHLY = Object.freeze({
    basicSalary: 'basicSalaryAnnual',
    hra: 'hraAnnual',
    specialAllowance: 'specialAllowanceAnnual',
    otherAllowance: 'otherAllowanceAnnual',
    grossSalary: 'grossSalaryAnnual',
    employeePF: 'employeePFAnnual',
    employeeESI: 'employeeESIAnnual',
    employerPF: 'employerPFAnnual',
    employerESI: 'employerESIAnnual',
    gratuity: 'gratuityAnnual',
    totalDeductions: 'totalDeductionsAnnual',
    totalCTC: 'totalCTC', // annual column uses totalCTC; monthly uses totalCTCMonthly
});

const MONTHLY_TOKEN_FOR_DUAL = Object.freeze({
    totalCTC: 'totalCTCMonthly',
    annualCTC: 'totalCTCMonthly',
    salary: 'totalCTCMonthly',
});

const ANNUAL_LABEL_BY_TOKEN = Object.freeze({
    basicSalaryAnnual: 'Basic Salary (Annual)',
    hraAnnual: 'HRA (Annual)',
    specialAllowanceAnnual: 'Special Allowance (Annual)',
    otherAllowanceAnnual: 'Other Allowance (Annual)',
    grossSalaryAnnual: 'Gross Salary (Annual)',
    employeePFAnnual: 'Employee PF (Annual)',
    employeeESIAnnual: 'Employee ESI (Annual)',
    employerPFAnnual: 'Employer PF (Annual)',
    employerESIAnnual: 'Employer ESI (Annual)',
    gratuityAnnual: 'Gratuity (Annual)',
    totalDeductionsAnnual: 'Total Deductions (Annual)',
    totalCTCMonthly: 'Total CTC (Monthly)',
});

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const DATE_REGEX = /^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}$/;
const LONG_DATE_REGEX = /^\d{1,2}(?:st|nd|rd|th)?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{2,4}$/i;
const CURRENCY_REGEX = /^(?:rs\.?\s*|inr\s*)?[\d,]+(?:\.\d+)?$/i;
const CURRENCY_WITH_PREFIX_REGEX = /^(?:rs\.?\s*|inr\s*)[\d,]+(?:\.\d+)?$/i;

const Y_TOLERANCE = 4;
const LINE_GAP_THRESHOLD = 14;

export function confidenceLevel(score) {
    if (score >= CONFIDENCE_HIGH) return 'high';
    if (score >= CONFIDENCE_MEDIUM) return 'medium';
    return 'low';
}

function normalizeLabel(text) {
    return String(text || '').toLowerCase().replace(/[:\-–—|]+$/g, '').trim();
}

function matchLabelToToken(labelText) {
    const normalized = normalizeLabel(labelText);
    if (!normalized) return null;

    for (const rule of FIELD_LABEL_RULES) {
        for (const label of rule.labels) {
            if (normalized === label || normalized.endsWith(` ${label}`) || normalized.startsWith(`${label} `)) {
                return rule.token;
            }
        }
    }
    return null;
}

function isEmailValue(text) {
    return EMAIL_REGEX.test(String(text || '').trim());
}

function isDateValue(text) {
    const t = String(text || '').trim().replace(/\.$/, '');
    return DATE_REGEX.test(t) || LONG_DATE_REGEX.test(t);
}

function isCurrencyValue(text) {
    const t = String(text || '').trim();
    return CURRENCY_REGEX.test(t) || CURRENCY_WITH_PREFIX_REGEX.test(t);
}

function scoreValueFormat(token, value) {
    const v = String(value || '').trim();
    if (!v) return 0;

    if (['startDate', 'offerDate', 'offerExpiryDate'].includes(token) && isDateValue(v)) return 20;
    if (['annualCTC', 'salary', 'totalCTC', 'basicSalary', 'hra', 'specialAllowance',
        'grossSalary', 'employeePF', 'employeeESI', 'employerPF', 'employerESI', 'gratuity',
        'professionalTax', 'tds', 'otherAllowance', 'totalDeductions',
        'basicSalaryAnnual', 'hraAnnual', 'specialAllowanceAnnual', 'grossSalaryAnnual',
        'employeePFAnnual', 'employeeESIAnnual', 'employerPFAnnual', 'employerESIAnnual',
        'gratuityAnnual', 'totalDeductionsAnnual'].includes(token)
        && isCurrencyValue(v)) return 20;
    if (token === 'salaryWords' && /rupees|lakh|crore|thousand|only/i.test(v)) return 20;
    if (token === 'phone' && /[\d+\-() ]{8,}/.test(v)) return 15;
    if (token === 'candidateName' && v.length >= 3 && v.split(/\s+/).length >= 1 && !isEmailValue(v)) return 10;
    if (token === 'leaveEntitlement' && /\d+|leave|day/i.test(v)) return 10;
    if (v.length >= 2 && v.length <= 80) return 5;
    return 0;
}

function isStrongCompanyNameLabel(labelPart) {
    const n = normalizeLabel(labelPart);
    return /^(company name|company|organisation name|organization name|employer name|employer)$/i.test(n);
}

/** Reject company / org names mistakenly mapped as candidate name. */
function isLikelyCompanyOrOrgName(text) {
    const t = String(text || '').trim();
    if (!t) return false;
    if (/PRIVATE\s+LIMITED|PVT\.?\s*LTD|LIMITED|TECHNOLOGIES|SOLUTIONS|CORPORATION|INC\.?|LLC/i.test(t)) {
        return true;
    }
    if (t === t.toUpperCase() && t.length >= 12 && !/\d/.test(t) && t.split(/\s+/).length >= 2) {
        return true;
    }
    return false;
}

/** Group text items into reading-order lines per page. */
export function groupTextItemsIntoLines(items = []) {
    const byPage = new Map();
    for (const item of items) {
        const page = item.page ?? 0;
        if (!byPage.has(page)) byPage.set(page, []);
        byPage.get(page).push(item);
    }

    const lines = [];
    for (const [page, pageItems] of [...byPage.entries()].sort((a, b) => a[0] - b[0])) {
        const sorted = [...pageItems].sort((a, b) => {
            const yDiff = b.y - a.y;
            if (Math.abs(yDiff) > Y_TOLERANCE) return yDiff;
            return a.x - b.x;
        });

        let currentLine = [];
        let currentY = null;

        for (const item of sorted) {
            if (currentY == null || Math.abs(item.y - currentY) <= Y_TOLERANCE) {
                currentLine.push(item);
                currentY = currentY == null ? item.y : (currentY + item.y) / 2;
            } else {
                if (currentLine.length) {
                    lines.push(buildLine(page, currentLine));
                }
                currentLine = [item];
                currentY = item.y;
            }
        }
        if (currentLine.length) lines.push(buildLine(page, currentLine));
    }

    return lines;
}

function buildLine(page, items) {
    const sorted = [...items].sort((a, b) => a.x - b.x);
    const text = sorted.map((i) => i.text).join(' ').replace(/\s+/g, ' ').trim();
    const x = sorted[0]?.x ?? 0;
    const y = sorted.reduce((sum, i) => sum + i.y, 0) / sorted.length;
    const last = sorted[sorted.length - 1];
    const width = (last.x + (last.width || 0)) - x;
    const height = Math.max(...sorted.map((i) => i.height || i.fontSize || 11));
    return { page, text, items: sorted, x, y, width, height };
}

function findValueItems(line, valueText) {
    const trimmed = String(valueText || '').trim();
    if (!trimmed) return [];

    const exact = line.items.filter(
        (i) => i.text.trim().toLowerCase() === trimmed.toLowerCase(),
    );
    if (exact.length) return exact;

    const fullText = line.text;
    const idx = fullText.toLowerCase().indexOf(trimmed.toLowerCase());
    if (idx < 0) return [];

    let charPos = 0;
    const matched = [];
    for (const item of line.items) {
        const itemStart = charPos;
        const itemText = item.text;
        charPos += itemText.length + 1;
        const itemEnd = charPos - 1;
        if (itemEnd > idx && itemStart < idx + trimmed.length) {
            matched.push(item);
        }
    }
    return matched;
}

/** Tight bbox for a dynamic value substring; falls back to item union when needed. */
function bboxForValueOnLine(line, sourceText, valueItems = []) {
    const cleaned = String(sourceText || '').trim();
    if (!cleaned) return null;
    const tight = line ? estimateSubstringBBox(line, cleaned) : null;
    if (tight && !isInflatedSourceBbox({ ...tight, sourceText: cleaned }, cleaned)) {
        return tight;
    }
    const fromItems = boundingBoxFromItems(valueItems);
    if (fromItems && !isInflatedSourceBbox({ ...fromItems, sourceText: cleaned }, cleaned)) {
        return fromItems;
    }
    return tight || fromItems;
}

function boundingBoxFromItems(items) {
    if (!items?.length) return null;
    const x = Math.min(...items.map((i) => i.x));
    const y = Math.min(...items.map((i) => i.y));
    const right = Math.max(...items.map((i) => i.x + (i.width || 0)));
    const bottom = Math.max(...items.map((i) => i.y + (i.height || i.fontSize || 11)));
    return {
        page: items[0].page ?? 0,
        x: Math.round(x * 100) / 100,
        y: Math.round(y * 100) / 100,
        width: Math.round((right - x) * 100) / 100,
        height: Math.round((bottom - y) * 100) / 100,
        fontSize: items[0].fontSize ?? 11,
    };
}

function makeDetection({
    token,
    sourceText,
    valueItems,
    line,
    detectedLabel,
    baseScore,
    labelScore = 60,
    formatScore = 0,
    contextBonus = 0,
}) {
    let cleaned = String(sourceText || '').trim();
    // Strip decorative quotes for names; keep them for quoted position titles
    if (token !== 'position') {
        cleaned = cleaned.replace(/^["'“”]+|["'“”]+$/g, '').trim();
    }
    const bbox = bboxForValueOnLine(line, cleaned, valueItems);
    if (!bbox || !cleaned) return null;
    if (isInflatedSourceBbox({ ...bbox, sourceText: cleaned }, cleaned)) return null;

    const confidence = Math.min(100, Math.round(baseScore + labelScore + formatScore + contextBonus));
    const level = confidenceLevel(confidence);

    return {
        placeholderToken: token,
        label: ANNUAL_LABEL_BY_TOKEN[token] || LABEL_BY_TOKEN.get(token) || token,
        detectedLabel: detectedLabel || '',
        sourceText: cleaned,
        itemKey: buildItemKey({ ...bbox, text: cleaned }),
        page: bbox.page,
        x: bbox.x,
        y: bbox.y,
        width: bbox.width,
        height: bbox.height,
        fontSize: bbox.fontSize,
        confidence,
        confidenceLevel: level,
        replacementStrategy: 'overlay',
        status: level === 'low' ? 'not_detected' : (level === 'high' ? 'accepted' : 'pending'),
        required: ['candidateName', 'position'].includes(token),
    };
}

function detectInlineLabelValue(line) {
    const patterns = [
        /^(.+?)\s*[:：]\s*(.+)$/,
        /^(.+?)\s*[-–—]\s+(.+)$/,
    ];

    for (const pattern of patterns) {
        const match = line.text.match(pattern);
        if (!match) continue;

        const labelPart = match[1].trim();
        const valuePart = match[2].trim();
        if (!valuePart || valuePart.length < 1) continue;

        const token = matchLabelToToken(labelPart);
        if (!token) continue;
        if (token === 'candidateName') {
            if (isLikelyCompanyOrOrgName(valuePart)) continue;
            if (looksLikeCurrencyValue(valuePart) || looksLikeSalaryComponentLabel(valuePart)) continue;
            if (isInvalidCandidateNameFragment(valuePart)) continue;
            if (!isStrongCandidateNameLabel(labelPart) && !looksLikePersonName(valuePart)) continue;
        }
        if (token === 'companyName' && !isStrongCompanyNameLabel(labelPart)) continue;
        if (token === 'probationPeriod' && (isProbationProseCorruptionSource(valuePart) || !isValidProbationValueSource(valuePart))) {
            continue;
        }

        const valueItems = findValueItems(line, valuePart);
        const formatScore = scoreValueFormat(token, valuePart);

        return makeDetection({
            token,
            sourceText: valuePart,
            valueItems,
            line,
            detectedLabel: labelPart,
            baseScore: 15,
            labelScore: 65,
            formatScore,
            contextBonus: 10,
        });
    }
    return null;
}

function detectLabelAboveValue(lines, index) {
    const line = lines[index];
    const labelMatch = line.text.match(/^(.+?)\s*[:：]\s*$/);
    if (!labelMatch) return null;

    const labelPart = labelMatch[1].trim();
    const token = matchLabelToToken(labelPart);
    if (!token) return null;

    const nextLine = lines[index + 1];
    if (!nextLine || nextLine.page !== line.page) return null;
    if (Math.abs(nextLine.y - line.y) > LINE_GAP_THRESHOLD) return null;

    const valuePart = nextLine.text.trim();
    if (!valuePart) return null;
    if (token === 'candidateName') {
        if (isLikelyCompanyOrOrgName(valuePart)) return null;
        if (looksLikeCurrencyValue(valuePart) || looksLikeSalaryComponentLabel(valuePart)) return null;
        if (isInvalidCandidateNameFragment(valuePart)) return null;
        if (!isStrongCandidateNameLabel(labelPart) && !looksLikePersonName(valuePart)) return null;
    }
    if (token === 'companyName' && !isStrongCompanyNameLabel(labelPart)) return null;
    if (token === 'probationPeriod' && (isProbationProseCorruptionSource(valuePart) || !isValidProbationValueSource(valuePart))) {
        return null;
    }

    const formatScore = scoreValueFormat(token, valuePart);
    return makeDetection({
        token,
        sourceText: valuePart,
        valueItems: nextLine.items,
        line: nextLine,
        detectedLabel: labelPart,
        baseScore: 10,
        labelScore: 60,
        formatScore,
        contextBonus: 15,
    });
}

function detectDearPattern(line) {
    const match = line.text.match(/^dear\s+(.+?),?\s*$/i);
    if (!match?.[1]) return null;

    const name = match[1].trim();
    if (name.length < 2 || isEmailValue(name)) return null;
    if (isLikelyCompanyOrOrgName(name)) return null;
    if (isInvalidCandidateNameFragment(name) || !looksLikePersonName(name)) return null;

    const nameItems = findValueItems(line, name);
    return makeDetection({
        token: 'candidateName',
        sourceText: name,
        valueItems: nameItems,
        line,
        detectedLabel: 'Dear',
        baseScore: 20,
        labelScore: 55,
        formatScore: scoreValueFormat('candidateName', name),
        contextBonus: 20,
    });
}

function detectToPattern(lines, index) {
    const line = lines[index];
    const inlineMatch = line.text.match(/^to\s*[:：]?\s*(.+)$/i);
    if (inlineMatch?.[1]) {
        const name = inlineMatch[1].trim();
        if (name.length >= 2 && !isEmailValue(name) && !isLikelyCompanyOrOrgName(name)
            && !isInvalidCandidateNameFragment(name) && looksLikePersonName(name)) {
            return makeDetection({
                token: 'candidateName',
                sourceText: name,
                valueItems: findValueItems(line, name),
                line,
                detectedLabel: 'To',
                baseScore: 20,
                labelScore: 55,
                formatScore: scoreValueFormat('candidateName', name),
                contextBonus: 20,
            });
        }
    }

    if (/^to\s*[:：]?\s*$/i.test(line.text.trim())) {
        const nextLine = lines[index + 1];
        if (!nextLine || nextLine.page !== line.page) return null;
        if (Math.abs(nextLine.y - line.y) > LINE_GAP_THRESHOLD) return null;

        const name = nextLine.text.trim();
        if (name.length < 2 || isEmailValue(name) || isLikelyCompanyOrOrgName(name)
            || isInvalidCandidateNameFragment(name) || !looksLikePersonName(name)) return null;

        return makeDetection({
            token: 'candidateName',
            sourceText: name,
            valueItems: nextLine.items,
            line: nextLine,
            detectedLabel: 'To',
            baseScore: 15,
            labelScore: 55,
            formatScore: scoreValueFormat('candidateName', name),
            contextBonus: 25,
        });
    }
    return null;
}

function detectPositionOfPattern(line) {
    const quoted = line.text.match(/position of\s+((["']).+?\2)/i)
        || line.text.match(/offered the position of\s+((["']).+?\2)/i);
    if (quoted?.[1]) {
        const position = quoted[1].trim();
        if (position.length >= 3) {
            return makeDetection({
                token: 'position',
                sourceText: position,
                valueItems: findValueItems(line, position),
                line,
                detectedLabel: 'Position of',
                baseScore: 15,
                labelScore: 60,
                formatScore: 5,
                contextBonus: 15,
            });
        }
    }

    const match = line.text.match(/position of\s+(.+?)(?:\s+at\b|[.,]|$)/i)
        || line.text.match(/offered the position of\s+(.+?)(?:\s+at\b|[.,]|$)/i);
    if (!match?.[1]) return null;

    let position = match[1].trim();
    if (!position || position.length < 2) return null;

    const quotedSpan = findQuotedSpanInLine(line.text, position.replace(/^["'“”]+|["'“”]+$/g, ''));
    if (quotedSpan) position = quotedSpan;

    return makeDetection({
        token: 'position',
        sourceText: position,
        valueItems: findValueItems(line, position),
        line,
        detectedLabel: 'Position of',
        baseScore: 15,
        labelScore: 60,
        formatScore: 5,
        contextBonus: 15,
    });
}

/**
 * Detect natural-language CTC-in-words such as:
 * "CTC of Rupees Six Lakh Twenty Thousand Only"
 * "Rupees Four Lakh Fifty Thousand Only"
 */
function detectSalaryWordsNaturalLanguage(lines, index) {
    const line = lines[index];
    const text = line.text.trim();
    if (!text || isEmailValue(text)) return null;

    const wordsMatch = text.match(/Rupees\s+[A-Za-z][A-Za-z\s]*?\s+Only/i)
        || text.match(/[A-Za-z][A-Za-z\s]*?\s+Rupees\s+Only/i);
    if (!wordsMatch) return null;

    const sourceText = wordsMatch[0].trim();
    if (sourceText.length < 10) return null;

    const nearby = [lines[index - 1], line, lines[index + 1]]
        .filter(Boolean)
        .map((l) => l.text)
        .join(' ');
    const hasContext = /ctc|cost to company|compensation|salary|package|remuneration|in words|rupees/i.test(nearby);
    if (!hasContext) return null;

    return makeDetection({
        token: 'salaryWords',
        sourceText,
        valueItems: findValueItems(line, sourceText),
        line,
        detectedLabel: 'CTC in Words',
        baseScore: 20,
        labelScore: 55,
        formatScore: scoreValueFormat('salaryWords', sourceText),
        contextBonus: 15,
    });
}

/**
 * Detect salary-annexure rows like:
 * "Basic Salary  23,500  2,82,000"
 * without requiring a colon, mapping monthly (+ annual when present).
 */
function detectLabeledAmountRow(line) {
    const text = line.text.trim();
    if (!text) return [];

    // Prefer longer labels first to avoid "basic" matching before "basic salary"
    const rules = [...FIELD_LABEL_RULES].sort((a, b) => {
        const aLen = Math.max(...a.labels.map((l) => l.length));
        const bLen = Math.max(...b.labels.map((l) => l.length));
        return bLen - aLen;
    });

    for (const rule of rules) {
        // Skip non-currency fields for this detector
        if (!['annualCTC', 'salary', 'totalCTC', 'basicSalary', 'hra', 'specialAllowance',
            'otherAllowance', 'grossSalary', 'employeePF', 'employeeESI', 'employerPF',
            'employerESI', 'gratuity', 'professionalTax', 'tds', 'totalDeductions'].includes(rule.token)) {
            continue;
        }

        for (const label of rule.labels) {
            const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = new RegExp(`^(${escaped})\\s*[:：]?\\s+(.+)$`, 'i');
            const match = text.match(re);
            if (!match) continue;

            const labelPart = match[1].trim();
            const rest = match[2].trim();
            const amountMatches = [...rest.matchAll(/(?:Rs\.?\s*|INR\s*)?[\d,]+(?:\.\d+)?/gi)];
            if (!amountMatches.length) continue;

            const detections = [];
            const isDualCtc = ['annualCTC', 'salary', 'totalCTC'].includes(rule.token)
                && amountMatches.length >= 2;

            if (isDualCtc) {
                // Monthly column → totalCTCMonthly; Annual column → totalCTC / annualCTC
                const monthlyToken = MONTHLY_TOKEN_FOR_DUAL[rule.token] || 'totalCTCMonthly';
                const monthlyText = amountMatches[0][0].trim();
                const annualText = amountMatches[1][0].trim();
                const monthlyDet = makeDetection({
                    token: monthlyToken,
                    sourceText: monthlyText,
                    valueItems: findValueItems(line, monthlyText),
                    line,
                    detectedLabel: `${labelPart} (Monthly)`,
                    baseScore: 15,
                    labelScore: 60,
                    formatScore: scoreValueFormat(monthlyToken, monthlyText),
                    contextBonus: 10,
                });
                const annualDet = makeDetection({
                    token: rule.token === 'salary' ? 'annualCTC' : rule.token,
                    sourceText: annualText,
                    valueItems: findValueItems(line, annualText),
                    line,
                    detectedLabel: `${labelPart} (Annual)`,
                    baseScore: 15,
                    labelScore: 60,
                    formatScore: scoreValueFormat(rule.token, annualText),
                    contextBonus: 10,
                });
                if (monthlyDet) detections.push(monthlyDet);
                if (annualDet) detections.push(annualDet);
                return detections;
            }

            const primaryText = amountMatches[0][0].trim();
            const primaryDet = makeDetection({
                token: rule.token,
                sourceText: primaryText,
                valueItems: findValueItems(line, primaryText),
                line,
                detectedLabel: labelPart,
                baseScore: 15,
                labelScore: 60,
                formatScore: scoreValueFormat(rule.token, primaryText),
                contextBonus: 10,
            });
            if (primaryDet) detections.push(primaryDet);

            if (amountMatches.length >= 2) {
                const annualToken = ANNUAL_TOKEN_BY_MONTHLY[rule.token];
                if (annualToken && annualToken !== rule.token) {
                    const annualText = amountMatches[1][0].trim();
                    const annualDetection = makeDetection({
                        token: annualToken,
                        sourceText: annualText,
                        valueItems: findValueItems(line, annualText),
                        line,
                        detectedLabel: `${labelPart} (Annual)`,
                        baseScore: 15,
                        labelScore: 55,
                        formatScore: scoreValueFormat(annualToken, annualText),
                        contextBonus: 10,
                    });
                    if (annualDetection) detections.push(annualDetection);
                }
            }

            return detections;
        }
    }
    return [];
}

/**
 * Detect prose joining-date phrases:
 * "Your date of joining is 1st September 2026."
 */
function detectJoiningDateProse(line) {
    const text = line.text.trim();
    const match = text.match(
        /(?:your\s+)?date of joining(?:\s+is)?\s*[:\-]?\s*(.+?)(?:\.|$)/i,
    ) || text.match(
        /joining date(?:\s+is)?\s*[:\-]?\s*(.+?)(?:\.|$)/i,
    ) || text.match(
        /date of commencement(?:\s+is)?\s*[:\-]?\s*(.+?)(?:\.|$)/i,
    );
    if (!match?.[1]) return null;

    let value = match[1].trim().replace(/[.,;]+$/, '').trim();
    // Drop leading "is " if captured
    value = value.replace(/^is\s+/i, '').trim();
    if (!value || value.length < 4) return null;
    if (!isDateValue(value) && !LONG_DATE_REGEX.test(value) && !/\d/.test(value)) return null;

    return makeDetection({
        token: 'startDate',
        sourceText: value,
        valueItems: findValueItems(line, value),
        line,
        detectedLabel: 'Date of Joining',
        baseScore: 20,
        labelScore: 60,
        formatScore: scoreValueFormat('startDate', value),
        contextBonus: 15,
    });
}

/**
 * Detect prose notice-period phrases:
 * "you will have a notice period of 60 days"
 */
function detectNoticePeriodProse(line) {
    const text = line.text.trim();
    const match = text.match(
        /notice period(?:\s+of)?\s*[:\-]?\s*(\d+\s*(?:days?|months?|weeks?)?)/i,
    ) || text.match(
        /serving notice period(?:\s+of)?\s*[:\-]?\s*(\d+\s*(?:days?|months?|weeks?)?)/i,
    ) || text.match(
        /notice period will be\s+(\d+\s*(?:days?|months?|weeks?)?)/i,
    );
    if (!match?.[1]) return null;

    const value = match[1].trim();
    if (!value) return null;
    // Never bind notice to probation-completion sentences
    if (isProbationProseCorruptionSource(text) && !/notice period/i.test(text)) return null;

    return makeDetection({
        token: 'noticePeriod',
        sourceText: value,
        valueItems: findValueItems(line, value),
        line,
        detectedLabel: 'Notice Period',
        baseScore: 20,
        labelScore: 60,
        formatScore: 10,
        contextBonus: 15,
    });
}

/**
 * Detect probation duration values only — never "completion of your probation" prose.
 * Examples: "Probation Period: 6 Months", "probation period of 90 days"
 */
function detectProbationPeriodProse(line) {
    const text = line.text.trim();
    if (isProbationProseCorruptionSource(text)) return null;

    const match = text.match(
        /probation period(?:\s+of)?\s*[:\-]?\s*(\d+\s*(?:days?|months?|weeks?))/i,
    ) || text.match(
        /probation(?:\s+period)?\s*[:\-]\s*(\d+\s*(?:days?|months?|weeks?))/i,
    );
    if (!match?.[1]) return null;

    const value = match[1].trim();
    if (!isValidProbationValueSource(value)) return null;

    return makeDetection({
        token: 'probationPeriod',
        sourceText: value,
        valueItems: findValueItems(line, value),
        line,
        detectedLabel: 'Probation Period',
        baseScore: 20,
        labelScore: 60,
        formatScore: 10,
        contextBonus: 15,
    });
}

/**
 * Detect dynamic fields from extracted PDF text items.
 * Returns detections with confidence scores; LOW confidence fields are marked not_detected.
 * Multiple occurrences of the same token (e.g. Gross Salary in two annexure sections) are kept.
 */
export function detectPdfFields(extractedItems = []) {
    if (!extractedItems?.length) {
        return {
            detections: [],
            detectionStatus: 'no_text',
            summary: { high: 0, medium: 0, low: 0, notDetected: 0 },
        };
    }

    const lines = groupTextItemsIntoLines(extractedItems);
    const candidates = [];

    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        const detectors = [
            detectInlineLabelValue(line),
            detectLabelAboveValue(lines, i),
            detectDearPattern(line),
            detectToPattern(lines, i),
            detectPositionOfPattern(line),
            detectSalaryWordsNaturalLanguage(lines, i),
            detectJoiningDateProse(line),
            detectNoticePeriodProse(line),
            detectProbationPeriodProse(line),
        ];
        for (const detection of detectors) {
            if (!detection) continue;
            if (assessPdfMappingSafety(detection, extractedItems).incoherent) continue;
            candidates.push(detection);
        }
        const amountRows = detectLabeledAmountRow(line);
        if (amountRows.length) {
            for (const row of amountRows) {
                if (assessPdfMappingSafety(row, extractedItems).incoherent) continue;
                candidates.push(row);
            }
        }
    }

    // Keep unique occurrences by itemKey (same token may appear multiple times in annexure)
    const byKey = new Map();
    for (const detection of candidates) {
        const key = detection.itemKey
            || `${detection.placeholderToken}|${detection.page}|${detection.x}|${detection.y}`;
        const existing = byKey.get(key);
        if (!existing || detection.confidence > existing.confidence) {
            byKey.set(key, detection);
        }
    }

    const detections = [...byKey.values()].sort((a, b) => b.confidence - a.confidence);

    const summary = { high: 0, medium: 0, low: 0, notDetected: 0 };
    for (const d of detections) {
        if (d.confidenceLevel === 'high') summary.high += 1;
        else if (d.confidenceLevel === 'medium') summary.medium += 1;
        else summary.low += 1;
        if (d.status === 'not_detected') summary.notDetected += 1;
    }

    return {
        detections,
        detectionStatus: 'completed',
        summary,
    };
}

/** Convert accepted detections to field mappings for PDF generation. */
export function detectionsToFieldMappings(detections = [], { includeMedium = true } = {}) {
    return detections
        .filter((d) => {
            if (d.status === 'rejected' || d.status === 'not_detected') return false;
            if (d.confidenceLevel === 'high') return true;
            if (includeMedium && d.confidenceLevel === 'medium' && d.status !== 'rejected') return true;
            return d.status === 'accepted';
        })
        .map((d) => ({
            placeholderToken: d.placeholderToken,
            label: d.label,
            sourceText: d.sourceText,
            itemKey: d.itemKey,
            page: d.page,
            x: d.x,
            y: d.y,
            width: d.width,
            height: d.height,
            fontSize: d.fontSize,
            confidence: d.confidence,
            confidenceLevel: d.confidenceLevel,
            replacementStrategy: d.replacementStrategy || 'overlay',
            required: d.required !== false,
        }));
}

/** List all detectable field tokens with detection status for verification UI.
 * Multiple occurrences of the same token (annexure rows) each appear as their own row.
 */
export function buildVerificationFieldList(detections = []) {
    const fields = [];
    const seenKeys = new Set();
    const detectedTokens = new Set();

    // Prefer showing real detections first (including multi-occurrence salary cells)
    const sorted = [...detections].sort((a, b) => {
        if (a.page !== b.page) return (a.page || 0) - (b.page || 0);
        return (b.y || 0) - (a.y || 0);
    });

    for (const detection of sorted) {
        if (detection.placeholderToken === 'email' || detection.placeholderToken === 'candidateEmail') continue;
        const key = detection.itemKey
            || `${detection.placeholderToken}|${detection.page}|${detection.x}|${detection.y}|${detection.sourceText}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        detectedTokens.add(detection.placeholderToken);

        const hasSource = !!detection?.sourceText;
        const level = detection?.confidenceLevel || 'low';
        const detected = hasSource && level !== 'low' && detection.status !== 'not_detected';

        fields.push({
            placeholderToken: detection.placeholderToken,
            label: detection.label
                || ANNUAL_LABEL_BY_TOKEN[detection.placeholderToken]
                || LABEL_BY_TOKEN.get(detection.placeholderToken)
                || detection.placeholderToken,
            detected,
            hasSuggestion: hasSource,
            sourceText: detection.sourceText || null,
            confidence: detection.confidence ?? 0,
            confidenceLevel: level,
            status: detection.status || 'not_detected',
            page: detection.page,
            x: detection.x,
            y: detection.y,
            width: detection.width,
            height: detection.height,
            fontSize: detection.fontSize,
            itemKey: detection.itemKey || key,
            detectedLabel: detection.detectedLabel,
            occurrenceKey: key,
        });
    }

    // Ensure required tokens appear even when not detected (so HR can use advanced fallback)
    for (const token of ['candidateName', 'position']) {
        if (detectedTokens.has(token)) continue;
        fields.push({
            placeholderToken: token,
            label: LABEL_BY_TOKEN.get(token) || token,
            detected: false,
            hasSuggestion: false,
            sourceText: null,
            confidence: 0,
            confidenceLevel: 'low',
            status: 'not_detected',
            itemKey: `missing|${token}`,
            occurrenceKey: `missing|${token}`,
        });
    }

    return fields;
}

export default {
    CONFIDENCE_HIGH,
    CONFIDENCE_MEDIUM,
    confidenceLevel,
    groupTextItemsIntoLines,
    detectPdfFields,
    detectionsToFieldMappings,
    buildVerificationFieldList,
};
