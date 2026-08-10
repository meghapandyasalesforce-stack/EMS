/**
 * PDF offer mapping safety — reject incoherent field→region bindings.
 * Used at detection, save, and generation so bad Mongo mappings cannot corrupt PDFs.
 */

import { isInflatedSourceBbox } from './pdfMappingGeometry.js';

const SALARY_LIKE_TOKENS = new Set([
    'annualCTC', 'salary', 'totalCTC', 'totalCTCMonthly', 'basicSalary', 'basicSalaryAnnual',
    'hra', 'hraAnnual', 'specialAllowance', 'specialAllowanceAnnual', 'otherAllowance',
    'otherAllowanceAnnual', 'grossSalary', 'grossSalaryAnnual', 'employeePF', 'employeePFAnnual',
    'employeeESI', 'employeeESIAnnual', 'employerPF', 'employerPFAnnual', 'employerESI',
    'employerESIAnnual', 'gratuity', 'gratuityAnnual', 'professionalTax', 'tds',
    'totalDeductions', 'totalDeductionsAnnual', 'salaryWords',
]);

const SALARY_CONTEXT_RE = /\b(basic(?:\s+salary)?|hra|house\s*rent|gross(?:\s+salary)?|special(?:\s+allowance)?|other(?:\s+allowance)?|employee(?:\s+pf|\s+esi)?|employer(?:\s+pf|\s+esi)?|epf|esi|pf|gratuity|professional\s*tax|tds|total(?:\s+ctc|\s+deductions)?|fixed\s+total|components?|annexure|per\s+month|per\s+annum|salary|allowance|deduction|ctc|amount|variable|fixed)\b/i;

const PROBATION_PROSE_RE = /completion\s+of\s+(?:your\s+)?probation|upon\s+completion|successful\s+completion\s+of\s+(?:your\s+)?probation/i;

function bareToken(placeholderToken) {
    return String(placeholderToken || '').replace(/^\{\{|\}\}$/g, '');
}

export function looksLikeCurrencyValue(text) {
    const t = String(text || '').trim();
    return /^(?:rs\.?\s*|inr\s*)?[\d,]+(?:\.\d+)?$/i.test(t)
        || /^(?:rs\.?\s*|inr\s*)/i.test(t);
}

export function looksLikeSalaryComponentLabel(text) {
    const t = String(text || '').trim();
    if (!t) return false;
    if (SALARY_CONTEXT_RE.test(t) && t.length <= 48) return true;
    return /^(basic|hra|gross|epf|esi|pf|gratuity|tds|components?|fixed|variable|amount|salary|tax)\b/i.test(t);
}

export function looksLikeBlankOrUnderscore(text) {
    const t = String(text || '').trim();
    return /^[_\-–—.…]{2,}$/.test(t) || /^_{2,}/.test(t);
}

export function looksLikePersonName(text) {
    const t = String(text || '').trim();
    if (!t || t.length > 60) return false;
    if (/\d/.test(t)) return false;
    if (/rupees|lakh|crore|only|private|limited|completion|probation|notice|joining/i.test(t)) {
        return false;
    }
    if (looksLikeSalaryComponentLabel(t)) return false;
    if (isInvalidCandidateNameFragment(t)) return false;
    return /^[A-Za-z][A-Za-z.'\-\s]{1,58}[A-Za-z.]?$/.test(t);
}

/** Reject annexure fragments, salary rows, and prose mistaken as candidate names. */
export function isInvalidCandidateNameFragment(text) {
    const t = String(text || '').trim();
    if (!t) return true;
    if (/\d|[,]/.test(t)) return true;
    if (t.split(/\s+/).length > 4) return true;
    if (t.length > 45) return true;
    if (/^tal\b/i.test(t)) return true;
    if (/deduction|annexure|ctc|salary|gross|basic|hra|employer|employee|share|components|fixed|variable|total|gratuity|tds|tax|rupees|lakh|only/i.test(t)) {
        return true;
    }
    if (/ensure|that|possession|required|disclose|confidential|completion|probation|notice period|joining|mpletion|undertake|hereby|shall|agreement|terms|conditions/i.test(t)) {
        return true;
    }
    return false;
}

/** Labels that strongly indicate a candidate-name slot (not bare prose). */
export function isStrongCandidateNameLabel(labelPart) {
    const n = String(labelPart || '').toLowerCase().replace(/[:\-–—|]+$/g, '').trim();
    return /^(candidate name|employee name|applicant name|full name|name|dear|to)$/i.test(n);
}

export function isProbationProseCorruptionSource(text) {
    const t = String(text || '').trim();
    if (!t) return false;
    if (PROBATION_PROSE_RE.test(t)) return true;
    if (/probation/i.test(t) && !/^\d+\s*(days?|months?|weeks?)$/i.test(t) && t.split(/\s+/).length >= 4) {
        return true;
    }
    return false;
}

export function isValidProbationValueSource(text) {
    const t = String(text || '').trim();
    if (!t) return false;
    if (isProbationProseCorruptionSource(t)) return false;
    return /^\d+\s*(days?|months?|weeks?)?$/i.test(t)
        || /^\d+\s*-\s*\d+\s*(days?|months?|weeks?)$/i.test(t);
}

/**
 * Nearby extracted items on the same line / row as the mapping (to the left).
 */
export function leftContextText(mapping, extractedTextItems = []) {
    if (!mapping || !extractedTextItems?.length) return '';
    const page = mapping.page ?? 0;
    const y = Number(mapping.y) || 0;
    const x = Number(mapping.x) || 0;
    return extractedTextItems
        .filter((i) => (
            (i.page ?? 0) === page
            && Math.abs((i.y || 0) - y) <= 5
            && (i.x || 0) < x - 1
        ))
        .sort((a, b) => a.x - b.x)
        .map((i) => i.text)
        .join(' ');
}

/**
 * Full line text at the mapping's Y coordinate (for prose-sentence guards).
 */
export function sameLineText(mapping, extractedTextItems = []) {
    if (!mapping || !extractedTextItems?.length) return '';
    const page = mapping.page ?? 0;
    const y = Number(mapping.y) || 0;
    const onLine = extractedTextItems
        .filter((i) => (i.page ?? 0) === page && Math.abs((i.y || 0) - y) <= 5)
        .sort((a, b) => a.x - b.x);
    return onLine.map((i) => i.text).join(' ').replace(/\s+/g, ' ').trim();
}

/** Tokens where a shorter replacement should hug the trailing static punctuation (e.g. comma after Dear Name). */
const RIGHT_ALIGN_SHORTER_TOKENS = new Set([
    'candidateName',
]);

function isProbationCompletionProseLine(lineText) {
    return /completion\s+of\s+(?:your\s+)?probation|upon\s+completion\s+of\s+(?:your\s+)?probation/i.test(lineText || '');
}

function isNoticePeriodPhraseLine(lineText) {
    return /notice\s+period\s+(?:of|will\s+be)/i.test(lineText || '');
}

/**
 * @returns {{ incoherent: boolean, reason?: string }}
 */
export function assessPdfMappingSafety(mapping, extractedTextItems = []) {
    const token = bareToken(mapping?.placeholderToken);
    const source = String(mapping?.sourceText || mapping?.searchText || '').trim();
    const label = String(mapping?.label || mapping?.detectedLabel || '').trim();
    if (!token || !source) {
        return { incoherent: false };
    }

    const left = leftContextText(mapping, extractedTextItems);
    const lineText = sameLineText(mapping, extractedTextItems);
    const contextBlob = `${label} ${left} ${source}`;

    if (['candidateName', 'position', 'department', 'reportingManager'].includes(token)) {
        if (looksLikeCurrencyValue(source) || looksLikeBlankOrUnderscore(source)) {
            return { incoherent: true, reason: `${token} mapped to currency/blank cell "${source}"` };
        }
        if (looksLikeSalaryComponentLabel(source)) {
            return { incoherent: true, reason: `${token} mapped to salary label "${source}"` };
        }
        if (token === 'candidateName') {
            if (isInvalidCandidateNameFragment(source)) {
                return { incoherent: true, reason: `candidateName mapped to non-name fragment "${source.slice(0, 50)}"` };
            }
            if (!looksLikePersonName(source)) {
                return { incoherent: true, reason: `candidateName source is not a person name: "${source.slice(0, 50)}"` };
            }
            const hasNameContext = isStrongCandidateNameLabel(label)
                || isStrongCandidateNameLabel(mapping.detectedLabel)
                || /dear|candidate name|employee name|applicant name|full name|\bname\b/i.test(left)
                || /dear|candidate name|employee name|applicant name|full name|\bname\b/i.test(lineText);
            if (!hasNameContext && (SALARY_CONTEXT_RE.test(lineText) || SALARY_CONTEXT_RE.test(left))) {
                return { incoherent: true, reason: 'candidateName without name context on salary/annexure line' };
            }
        }
        if (token === 'candidateName' && SALARY_CONTEXT_RE.test(left) && !/dear|name|candidate|employee name|\bto\b/i.test(left)) {
            return { incoherent: true, reason: `candidateName in salary-row context "${left.slice(0, 60)}"` };
        }
        if (token === 'candidateName' && SALARY_CONTEXT_RE.test(label) && !/name|candidate|employee/i.test(label)) {
            return { incoherent: true, reason: `candidateName with salary label "${label}"` };
        }
    }

    if (token === 'probationPeriod') {
        if (isProbationProseCorruptionSource(source) || isProbationProseCorruptionSource(label)) {
            return { incoherent: true, reason: 'probationPeriod mapped onto completion-of-probation prose' };
        }
        if (!isValidProbationValueSource(source) && source.split(/\s+/).length >= 5) {
            return { incoherent: true, reason: `probationPeriod source is not a duration value: "${source.slice(0, 50)}"` };
        }
        if (/completion|upon\s+completion|notice period will be/i.test(left)) {
            return { incoherent: true, reason: 'probationPeriod coordinates sit inside probation-completion prose' };
        }
        // "1. Upon completion of your probation…" — reject duration at line start (e.g. "15 days" over "Upon")
        if (isProbationCompletionProseLine(lineText)) {
            const hasProbationLabel = /probation\s*period\s*:?\s*$/i.test(left)
                || /probation\s*period/i.test(label);
            if (!hasProbationLabel) {
                return { incoherent: true, reason: 'probationPeriod on completion-prose line without Probation Period label' };
            }
        }
    }

    if (token === 'noticePeriod') {
        if (isProbationProseCorruptionSource(source)) {
            return { incoherent: true, reason: 'noticePeriod mapped onto probation-completion prose' };
        }
        if (isInflatedSourceBbox(mapping, source)) {
            return { incoherent: true, reason: `noticePeriod bbox covers full sentence, not "${source}"` };
        }
        if (/[\d,]{4,}/.test(source.replace(/\s/g, '')) && /[.,]/.test(source)) {
            return { incoherent: true, reason: `noticePeriod mapped to salary-like amount "${source}"` };
        }
        if (SALARY_CONTEXT_RE.test(left) && !/notice/i.test(left)) {
            return { incoherent: true, reason: 'noticePeriod in salary annexure context' };
        }
        const okDuration = /^\d+\s*(days?|months?|weeks?)?$/i.test(source);
        if (!okDuration && source.split(/\s+/).length >= 6) {
            return { incoherent: true, reason: `noticePeriod source is not a duration: "${source.slice(0, 50)}"` };
        }
        // Reject noticePeriod at line start on "Upon completion… notice period of 60 days" sentences
        if (isProbationCompletionProseLine(lineText) && !isNoticePeriodPhraseLine(left)) {
            const nearLineStart = (Number(mapping.x) || 0) < 120
                || /^\d+\.?\s*$/.test(left.trim());
            if (nearLineStart && !/notice\s+period/i.test(left)) {
                return { incoherent: true, reason: 'noticePeriod mapped at line start of completion-prose sentence' };
            }
        }
    }

    const SUBSTRING_VALUE_TOKENS = new Set([
        'noticePeriod', 'probationPeriod', 'startDate', 'offerDate', 'offerExpiryDate',
    ]);
    if (SUBSTRING_VALUE_TOKENS.has(token) && isInflatedSourceBbox(mapping, source)) {
        return { incoherent: true, reason: `${token} bbox is wider than source text "${source}"` };
    }

    if (SALARY_LIKE_TOKENS.has(token)) {
        if (looksLikePersonName(source) && !/rupees|lakh|only/i.test(source)) {
            return { incoherent: true, reason: `${token} mapped to person-name text "${source}"` };
        }
        if (token === 'salaryWords' && !/rupees|lakh|crore|thousand|only/i.test(source)) {
            if (looksLikeCurrencyValue(source) || looksLikePersonName(source)) {
                return { incoherent: true, reason: `salaryWords mapped to non-words text "${source}"` };
            }
        }
    }

    if (token === 'candidateName' && SALARY_CONTEXT_RE.test(contextBlob) && looksLikeCurrencyValue(source)) {
        return { incoherent: true, reason: 'candidateName on salary amount' };
    }

    if (SALARY_LIKE_TOKENS.has(token) && source.split(/\s+/).length >= 3 && /[A-Za-z]{2,}/.test(source) && looksLikeCurrencyValue(source.split(/\s+/).pop())) {
        const parts = source.match(/(?:Rs\.?\s*|INR\s*)?[\d,]+(?:\.\d+)?/gi);
        if (parts && parts.length >= 2 && /deduction|share|pf|esi|ctc|salary|hra|gross|basic/i.test(source)) {
            return { incoherent: true, reason: `${token} mapped to merged salary row "${source.slice(0, 50)}"` };
        }
    }

    return { incoherent: false };
}

export function isIncoherentPdfMapping(mapping, extractedTextItems = []) {
    return assessPdfMappingSafety(mapping, extractedTextItems).incoherent;
}

export function filterSafePdfMappings(mappings = [], extractedTextItems = [], { onSkip } = {}) {
    const kept = [];
    for (const mapping of mappings || []) {
        const assessment = assessPdfMappingSafety(mapping, extractedTextItems);
        if (assessment.incoherent) {
            if (typeof onSkip === 'function') onSkip(mapping, assessment.reason);
            continue;
        }
        kept.push(mapping);
    }
    return kept;
}

export { SALARY_LIKE_TOKENS, SALARY_CONTEXT_RE, RIGHT_ALIGN_SHORTER_TOKENS };

export default {
    assessPdfMappingSafety,
    isIncoherentPdfMapping,
    filterSafePdfMappings,
    looksLikeCurrencyValue,
    looksLikeSalaryComponentLabel,
    looksLikePersonName,
    isInvalidCandidateNameFragment,
    isStrongCandidateNameLabel,
    isProbationProseCorruptionSource,
    isValidProbationValueSource,
    leftContextText,
    sameLineText,
};
