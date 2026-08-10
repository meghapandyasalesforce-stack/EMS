/**
 * Centralized offer letter placeholder resolution, HTML rendering, and validation.
 * Used by preview and final offer generation — keep logic in one place.
 */

import {
    computeEarningsFromGross,
    employeePfFromBasicWage,
    employerPfFromBasicWage,
} from './salaryCalculation.js';
import { normalizeRichHtml } from './normalizeRichHtml.js';

/** Monthly gross at or below this limit is ESI-eligible (India statutory). */
const ESI_GROSS_WAGE_LIMIT = 21000;

export const OFFER_PLACEHOLDER_DEFINITIONS = Object.freeze([
    { token: 'candidateName', label: 'Candidate Name' },
    { token: 'email', label: 'Email', aliases: ['candidateEmail'] },
    { token: 'phone', label: 'Phone' },
    { token: 'position', label: 'Position' },
    { token: 'department', label: 'Department' },
    { token: 'reportingManager', label: 'Reporting Manager' },
    { token: 'employmentType', label: 'Employment Type' },
    { token: 'salary', label: 'Annual CTC' },
    { token: 'annualCTC', label: 'Annual CTC' },
    { token: 'basicSalary', label: 'Basic Salary' },
    { token: 'hra', label: 'HRA' },
    { token: 'specialAllowance', label: 'Special Allowance' },
    { token: 'grossSalary', label: 'Gross Salary' },
    { token: 'employeePF', label: 'Employee PF' },
    { token: 'employeeESI', label: 'Employee ESI' },
    { token: 'employerPF', label: 'Employer PF' },
    { token: 'employerESI', label: 'Employer ESI' },
    { token: 'gratuity', label: 'Gratuity' },
    { token: 'totalDeductions', label: 'Total Deductions' },
    { token: 'totalCTC', label: 'Total CTC' },
    { token: 'startDate', label: 'Date of Joining' },
    { token: 'offerDate', label: 'Offer Date' },
    { token: 'offerExpiryDate', label: 'Offer Expiry Date' },
    { token: 'probationPeriod', label: 'Probation Period' },
    { token: 'noticePeriod', label: 'Notice Period' },
    { token: 'workingHours', label: 'Working Hours' },
    { token: 'location', label: 'Location' },
    { token: 'companyName', label: 'Company Name', aliases: ['company'] },
    { token: 'companyAddress', label: 'Company Address' },
    { token: 'companyEmail', label: 'Company Email' },
    { token: 'companyPhone', label: 'Company Phone' },
    { token: 'companyWebsite', label: 'Company Website' },
    { token: 'currentDate', label: 'Current Date' },
    { token: 'benefits', label: 'Benefits' },
    { token: 'salaryWords', label: 'Salary in Words', aliases: ['annualCTCInWords'] },
    { token: 'leaveEntitlement', label: 'Leave Entitlement' },
    { token: 'professionalTax', label: 'Professional Tax' },
    { token: 'tds', label: 'TDS' },
    { token: 'otherAllowance', label: 'Other Allowance' },
]);

const PLACEHOLDER_LABEL_BY_TOKEN = new Map();
for (const def of OFFER_PLACEHOLDER_DEFINITIONS) {
    PLACEHOLDER_LABEL_BY_TOKEN.set(def.token, def.label);
    for (const alias of def.aliases || []) {
        PLACEHOLDER_LABEL_BY_TOKEN.set(alias, def.label);
    }
}

/** Placeholders that may be left blank without blocking preview/generate. */
export const OPTIONAL_OFFER_PLACEHOLDER_TOKENS = Object.freeze(new Set([
    'reportingManager',
    'leaveEntitlement',
    'professionalTax',
    'tds',
    'otherAllowance',
]));

function asToken(key) {
    return key.startsWith('{{') ? key : `{{${key}}}`;
}

function formatDate(value) {
    if (!value) return '';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-IN');
}

const MONTH_NAMES = Object.freeze([
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
]);

/** Professional long-form date for PDF offer letters (does not affect HTML flow).
 * Uses ordinal day to match typical offer-letter phrasing: "1st September 2026".
 */
export function formatOfferDateProfessional(value) {
    if (!value) return '';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const day = d.getDate();
    const ordinal = dayOrdinal(day);
    return `${day}${ordinal} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function dayOrdinal(day) {
    const j = day % 10;
    const k = day % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
}

/** Apply professional date formatting to PDF placeholder map only. */
export function applyPdfDateFormatting(placeholderMap = {}, rawDates = {}) {
    const result = { ...placeholderMap };
    const dateTokens = ['startDate', 'offerDate', 'offerExpiryDate', 'currentDate'];
    for (const token of dateTokens) {
        const raw = rawDates[token];
        if (raw) {
            const formatted = formatOfferDateProfessional(raw);
            if (formatted) result[asToken(token)] = formatted;
        }
    }
    return result;
}

export function formatOfferCurrency(amount) {
    if (amount == null || amount === '') return '';
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 0) return '';
    // Keep Rs 0 for statutory components (e.g. ESI when not eligible) so templates stay valid
    if (n === 0) return 'Rs 0';
    return `Rs ${n.toLocaleString('en-IN')}`;
}

/**
 * Convert a numeric amount to Indian-style words for offer letters.
 * Example: 500000 → "Five Lakh Rupees Only"
 * Reuses the same CTC figure as salary/annualCTC — does not recalculate package.
 */
export function amountToWordsINR(amount) {
    const n = Math.floor(Number(amount) || 0);
    if (!Number.isFinite(n) || n <= 0) return '';

    const ones = [
        '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
        'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
    ];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const toWordsUpTo99 = (x) => {
        if (x < 20) return ones[x];
        return tens[Math.floor(x / 10)] + (x % 10 ? ` ${ones[x % 10]}` : '');
    };
    const toWordsUpTo999 = (x) => {
        if (x === 0) return '';
        if (x < 100) return toWordsUpTo99(x);
        return `${ones[Math.floor(x / 100)]} Hundred${x % 100 ? ` ${toWordsUpTo99(x % 100)}` : ''}`;
    };

    let s = String(n).replace(/^0+/, '') || '0';
    while (s.length < 9) s = `0${s}`;
    const crore = parseInt(s.slice(0, 2), 10);
    const lakh = parseInt(s.slice(2, 4), 10);
    const thousand = parseInt(s.slice(4, 6), 10);
    const hundred = parseInt(s.slice(6, 9), 10);
    const parts = [];
    if (crore > 0) parts.push(`${toWordsUpTo99(crore)} Crore`);
    if (lakh > 0) parts.push(`${toWordsUpTo99(lakh)} Lakh`);
    if (thousand > 0) parts.push(`${toWordsUpTo99(thousand)} Thousand`);
    if (hundred > 0) parts.push(toWordsUpTo999(hundred));
    const words = parts.join(' ').trim().replace(/\s+/g, ' ');
    if (!words) return '';
    return `${words} Rupees Only`;
}

export function formatOrgAddress(address) {
    if (!address) return '';
    if (typeof address === 'string') return address.trim();
    return [
        address.street,
        address.city,
        address.state,
        address.zipCode,
        address.country,
    ].filter(Boolean).join(', ');
}

export function formatWorkingHours(workingHours) {
    if (!workingHours) return '';
    const start = workingHours.start || workingHours.startTime;
    const end = workingHours.end || workingHours.endTime;
    if (start && end) return `${start} – ${end}`;
    return '';
}

function employeeDisplayName(employee) {
    if (!employee) return '';
    const parts = [employee.firstName, employee.lastName].filter(Boolean);
    if (parts.length) return parts.join(' ');
    return employee.name || '';
}

function computeSalaryBreakdown(annualCtc) {
    const annual = Number(annualCtc);
    if (!Number.isFinite(annual) || annual <= 0) return null;

    const monthlyGross = annual / 12;
    const earnings = computeEarningsFromGross(monthlyGross);
    const basicMonthly = earnings.basicWage;
    const hraMonthly = earnings.houseRentAllowance;
    const specialMonthly = earnings.specialAllowance;
    const grossMonthly = earnings.totalEarnings;

    const employeePFMonthly = employeePfFromBasicWage(basicMonthly);
    const employerPFMonthly = employerPfFromBasicWage(basicMonthly);
    const esiEligible = grossMonthly <= ESI_GROSS_WAGE_LIMIT;
    const employeeESIMonthly = esiEligible ? Math.round(grossMonthly * 0.0075) : 0;
    const employerESIMonthly = esiEligible ? Math.round(grossMonthly * 0.0325) : 0;
    const gratuityMonthly = Math.round(basicMonthly * 0.0481);
    const totalDeductionsMonthly = employeePFMonthly + employeeESIMonthly;

    const toAnnual = (monthly) => Math.round(monthly * 12);

    return {
        monthly: {
            basicSalary: basicMonthly,
            hra: hraMonthly,
            specialAllowance: specialMonthly,
            grossSalary: grossMonthly,
            employeePF: employeePFMonthly,
            employeeESI: employeeESIMonthly,
            employerPF: employerPFMonthly,
            employerESI: employerESIMonthly,
            gratuity: gratuityMonthly,
            totalDeductions: totalDeductionsMonthly,
            totalCTC: monthlyGross,
        },
        annual: {
            basicSalary: toAnnual(basicMonthly),
            hra: toAnnual(hraMonthly),
            specialAllowance: toAnnual(specialMonthly),
            grossSalary: toAnnual(grossMonthly),
            employeePF: toAnnual(employeePFMonthly),
            employeeESI: toAnnual(employeeESIMonthly),
            employerPF: toAnnual(employerPFMonthly),
            employerESI: toAnnual(employerESIMonthly),
            gratuity: toAnnual(gratuityMonthly),
            totalDeductions: toAnnual(totalDeductionsMonthly),
            totalCTC: annual,
        },
    };
}

function formatAmountMonthly(breakdown, field) {
    if (!breakdown) return '';
    return formatOfferCurrency(breakdown.monthly[field]);
}

function formatAmountAnnual(breakdown, field) {
    if (!breakdown) return '';
    return formatOfferCurrency(breakdown.annual[field]);
}

/**
 * Offer Notice Period only — never probationPeriod / probationNoticeDays.
 * Accepts "32", "32 days", "90 Days"; normalizes bare numbers to "N days".
 */
function resolveNoticePeriod(settings, payload = {}, offer = null) {
    const raw = payload.noticePeriod ?? offer?.noticePeriod;
    if (raw != null && String(raw).trim() !== '') {
        const trimmed = String(raw).trim();
        if (/^\d+$/.test(trimmed)) return `${trimmed} days`;
        if (/^\d+\s*(days?|months?|weeks?)$/i.test(trimmed)) {
            const num = trimmed.match(/^(\d+)/)[1];
            const unit = (trimmed.match(/(days?|months?|weeks?)/i) || ['days'])[0].toLowerCase();
            const normalizedUnit = unit.startsWith('day') ? 'days'
                : unit.startsWith('month') ? 'months'
                    : 'weeks';
            return `${num} ${normalizedUnit}`;
        }
        return trimmed;
    }
    // Explicit offer notice only — do NOT fall back to probationNoticeDays (that is 15 in many orgs)
    const days = settings?.noticePeriodPolicy?.defaultNoticeDays;
    if (days != null && days !== '') return `${Number(days)} days`;
    return '';
}

function resolveProbationPeriod(payload, candidate) {
    if (payload.probationPeriod) return String(payload.probationPeriod).trim();
    const fromOffer = candidate?.offerDetails?.probationPeriod;
    if (fromOffer) return String(fromOffer).trim();
    return '';
}

/**
 * Build placeholder map from offer → candidate → job → org → settings → payload overrides.
 */
export function buildOfferPlaceholderMap({
    candidate,
    org,
    offer,
    job,
    settings,
    payload = {},
}) {
    const candidateName = [candidate?.firstName, candidate?.lastName].filter(Boolean).join(' ');
    const email = candidate?.email || '';
    const phone = candidate?.phone || '';
    const position = offer?.position || payload.position || job?.jobTitle || '';
    const department = offer?.department || payload.department || job?.department || '';
    const annualCtc = offer?.salary ?? payload.salary ?? candidate?.offerDetails?.salary;
    const breakdown = computeSalaryBreakdown(annualCtc);
    const reportingManager = payload.reportingManager
        || employeeDisplayName(job?.hiringManager)
        || '';
    const employmentType = payload.employmentType || job?.employmentType || '';
    const startDate = formatDate(offer?.startDate ?? payload.startDate ?? candidate?.offerDetails?.startDate);
    const offerExpiryDate = formatDate(offer?.expiryDate ?? payload.expiryDate);
    const offerDate = formatDate(offer?.createdAt ?? payload.offerDate ?? new Date());
    const benefits = (offer?.benefits || payload.benefits || candidate?.offerDetails?.benefits || [])
        .filter(Boolean)
        .join(', ');

    const companyName = String(
        payload.companyName
        || payload.company
        || org?.legalName
        || org?.name
        || '',
    ).trim();
    const salaryWords = String(
        payload.annualCTCInWords
        || payload.salaryWords
        || amountToWordsINR(annualCtc)
        || '',
    ).trim();

    const base = {
        candidateName,
        email,
        candidateEmail: email,
        phone,
        position,
        department,
        reportingManager,
        employmentType,
        salary: formatOfferCurrency(annualCtc),
        annualCTC: formatOfferCurrency(annualCtc),
        basicSalary: formatAmountMonthly(breakdown, 'basicSalary'),
        basicSalaryAnnual: formatAmountAnnual(breakdown, 'basicSalary'),
        hra: formatAmountMonthly(breakdown, 'hra'),
        hraAnnual: formatAmountAnnual(breakdown, 'hra'),
        specialAllowance: formatAmountMonthly(breakdown, 'specialAllowance'),
        specialAllowanceAnnual: formatAmountAnnual(breakdown, 'specialAllowance'),
        grossSalary: formatAmountMonthly(breakdown, 'grossSalary'),
        grossSalaryAnnual: formatAmountAnnual(breakdown, 'grossSalary'),
        employeePF: formatAmountMonthly(breakdown, 'employeePF'),
        employeePFAnnual: formatAmountAnnual(breakdown, 'employeePF'),
        employeeESI: payload.employeeESI || formatAmountMonthly(breakdown, 'employeeESI'),
        employeeESIAnnual: formatAmountAnnual(breakdown, 'employeeESI'),
        employerPF: formatAmountMonthly(breakdown, 'employerPF'),
        employerPFAnnual: formatAmountAnnual(breakdown, 'employerPF'),
        employerESI: formatAmountMonthly(breakdown, 'employerESI'),
        employerESIAnnual: formatAmountAnnual(breakdown, 'employerESI'),
        gratuity: payload.gratuity || formatAmountMonthly(breakdown, 'gratuity'),
        gratuityAnnual: formatAmountAnnual(breakdown, 'gratuity'),
        totalDeductions: formatAmountMonthly(breakdown, 'totalDeductions'),
        totalDeductionsAnnual: formatAmountAnnual(breakdown, 'totalDeductions'),
        totalCTC: formatOfferCurrency(annualCtc),
        totalCTCMonthly: formatAmountMonthly(breakdown, 'totalCTC'),
        startDate,
        offerDate,
        offerExpiryDate,
        probationPeriod: resolveProbationPeriod(payload, candidate),
        noticePeriod: resolveNoticePeriod(settings, payload, offer),
        workingHours: payload.workingHours || formatWorkingHours(org?.workingHours),
        location: job?.location || payload.location || '',
        companyName,
        company: companyName,
        companyAddress: formatOrgAddress(org?.address),
        companyEmail: org?.email || '',
        companyPhone: org?.phone || '',
        companyWebsite: org?.website || '',
        currentDate: formatDate(new Date()),
        benefits,
        salaryWords,
        annualCTCInWords: salaryWords,
        leaveEntitlement: payload.leaveEntitlement
            || settings?.offerLetterDefaults?.leaveEntitlement
            || '',
        professionalTax: payload.professionalTax || '',
        tds: payload.tds || '',
        otherAllowance: payload.otherAllowance || '',
    };

    // Allow explicit payload overrides for any token (HR-entered values).
    for (const [key, value] of Object.entries(payload.placeholderOverrides || {})) {
        const token = key.replace(/^\{\{|\}\}$/g, '');
        if (value != null && String(value).trim() !== '') {
            base[token] = String(value);
        }
    }

    // Keep common template aliases aligned after overrides
    if (base.companyName) base.company = base.companyName;
    else if (base.company) base.companyName = base.company;
    if (base.salaryWords) base.annualCTCInWords = base.salaryWords;
    else if (base.annualCTCInWords) base.salaryWords = base.annualCTCInWords;

    const map = {};
    for (const [key, value] of Object.entries(base)) {
        map[asToken(key)] = value ?? '';
    }
    return map;
}

export function resolveOfferLetterHtml(templateHtml, placeholderMap = {}) {
    let html = normalizeRichHtml(templateHtml);
    for (const [token, value] of Object.entries(placeholderMap)) {
        const safe = value == null || value === 'undefined' || value === 'null' || value === 'NaN'
            ? ''
            : String(value);
        html = html.split(asToken(token)).join(safe);
    }
    // Never leave raw {{placeholders}} in the final document
    html = html.replace(/\{\{[a-zA-Z0-9_]+\}\}/g, '');
    return html;
}

export function findPlaceholdersInTemplate(html) {
    const matches = String(html || '').match(/\{\{[a-zA-Z0-9_]+\}\}/g) || [];
    return [...new Set(matches)];
}

export function findUnresolvedPlaceholders(html) {
    return findPlaceholdersInTemplate(html);
}

export function validateOfferLetterHtml(templateHtml, placeholderMap = {}) {
    const tokensInTemplate = findPlaceholdersInTemplate(templateHtml);
    const renderedHtml = resolveOfferLetterHtml(templateHtml, placeholderMap);
    const stillUnresolved = new Set(findUnresolvedPlaceholders(renderedHtml));

    const missing = [];
    for (const token of tokensInTemplate) {
        const key = token.slice(2, -2);
        if (OPTIONAL_OFFER_PLACEHOLDER_TOKENS.has(key)) continue;
        const value = placeholderMap[asToken(key)];
        const isEmpty = value == null || String(value).trim() === '';
        if (stillUnresolved.has(token) || isEmpty) {
            missing.push({
                token,
                label: PLACEHOLDER_LABEL_BY_TOKEN.get(key) || key,
            });
        }
    }

    const seen = new Set();
    const uniqueMissing = missing.filter((item) => {
        if (seen.has(item.label)) return false;
        seen.add(item.label);
        return true;
    });

    return {
        ok: uniqueMissing.length === 0,
        missing: uniqueMissing,
        renderedHtml,
        unresolvedTokens: [...stillUnresolved],
    };
}

/** Sample map for template-only preview (no candidate/offer context). */
export function buildSampleOfferPlaceholderMap() {
    const sampleBreakdown = computeSalaryBreakdown(1200000);
    const monthly = (field) => formatAmountMonthly(sampleBreakdown, field);
    const annual = (field) => formatAmountAnnual(sampleBreakdown, field);
    const base = {
        candidateName: 'Sample Candidate',
        email: 'candidate@example.com',
        candidateEmail: 'candidate@example.com',
        phone: '+91 98765 43210',
        position: 'Software Engineer',
        department: 'Engineering',
        reportingManager: 'Sample Manager',
        employmentType: 'Full-time',
        salary: formatOfferCurrency(1200000),
        annualCTC: formatOfferCurrency(1200000),
        basicSalary: monthly('basicSalary'),
        basicSalaryAnnual: annual('basicSalary'),
        hra: monthly('hra'),
        hraAnnual: annual('hra'),
        specialAllowance: monthly('specialAllowance'),
        specialAllowanceAnnual: annual('specialAllowance'),
        grossSalary: monthly('grossSalary'),
        grossSalaryAnnual: annual('grossSalary'),
        employeePF: monthly('employeePF'),
        employeePFAnnual: annual('employeePF'),
        employeeESI: monthly('employeeESI'),
        employeeESIAnnual: annual('employeeESI'),
        employerPF: monthly('employerPF'),
        employerPFAnnual: annual('employerPF'),
        employerESI: monthly('employerESI'),
        employerESIAnnual: annual('employerESI'),
        gratuity: monthly('gratuity'),
        gratuityAnnual: annual('gratuity'),
        totalDeductions: monthly('totalDeductions'),
        totalDeductionsAnnual: annual('totalDeductions'),
        totalCTC: formatOfferCurrency(1200000),
        totalCTCMonthly: monthly('totalCTC'),
        startDate: formatDate(new Date()),
        offerDate: formatDate(new Date()),
        offerExpiryDate: formatDate(new Date(Date.now() + 7 * 86400000)),
        probationPeriod: '6 months',
        noticePeriod: '60 days',
        workingHours: '09:00 – 18:00',
        location: 'Bengaluru',
        companyName: 'Sample Company Pvt. Ltd.',
        company: 'Sample Company Pvt. Ltd.',
        companyAddress: '123 Business Park, Bengaluru, Karnataka, India',
        companyEmail: 'hr@example.com',
        companyPhone: '+91 80 1234 5678',
        companyWebsite: 'www.example.com',
        currentDate: formatDate(new Date()),
        benefits: 'Health insurance, Paid time off',
        salaryWords: amountToWordsINR(1200000),
        annualCTCInWords: amountToWordsINR(1200000),
        leaveEntitlement: '18 days earned leave per year',
        professionalTax: '',
        tds: '',
        otherAllowance: '',
    };
    const map = {};
    for (const [key, value] of Object.entries(base)) {
        map[asToken(key)] = value;
    }
    return map;
}

export default {
    OFFER_PLACEHOLDER_DEFINITIONS,
    buildOfferPlaceholderMap,
    buildSampleOfferPlaceholderMap,
    resolveOfferLetterHtml,
    findUnresolvedPlaceholders,
    validateOfferLetterHtml,
    formatOfferCurrency,
    amountToWordsINR,
    formatOfferDateProfessional,
    applyPdfDateFormatting,
    formatOrgAddress,
};
