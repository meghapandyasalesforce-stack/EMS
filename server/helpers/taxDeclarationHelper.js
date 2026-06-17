import { getIndianFinancialYear } from './incomeTaxCalculation.js';

const NUMERIC_80C_FIELDS = ['ppf', 'lic', 'elss', 'tuitionFees', 'homeLoanPrincipal', 'other'];
const NUMERIC_80D_FIELDS = ['selfFamilyPremium', 'parentsPremium'];

function toNonNegativeInt(value) {
    const n = Math.round(Number(value));
    return Number.isFinite(n) && n > 0 ? n : 0;
}

function toBoolean(value) {
    return value === true || value === 'true' || value === 1 || value === '1';
}

export function sanitizeTaxDeclarationInput(body = {}) {
    const section80C = {};
    for (const key of NUMERIC_80C_FIELDS) {
        section80C[key] = toNonNegativeInt(body.section80C?.[key]);
    }

    const section80D = {
        selfFamilyPremium: toNonNegativeInt(body.section80D?.selfFamilyPremium),
        parentsPremium: toNonNegativeInt(body.section80D?.parentsPremium),
        selfSeniorCitizen: toBoolean(body.section80D?.selfSeniorCitizen),
        parentsSeniorCitizen: toBoolean(body.section80D?.parentsSeniorCitizen)
    };

    const hra = {
        monthlyRent: toNonNegativeInt(body.hra?.monthlyRent),
        landlordPan: body.hra?.landlordPan ? String(body.hra.landlordPan).trim().toUpperCase() : '',
        metroCity: toBoolean(body.hra?.metroCity)
    };

    return {
        financialYear: body.financialYear
            ? String(body.financialYear).trim()
            : getIndianFinancialYear(),
        section80C,
        section80D,
        section80E: {
            educationLoanInterest: toNonNegativeInt(body.section80E?.educationLoanInterest)
        },
        section24b: {
            homeLoanInterest: toNonNegativeInt(body.section24b?.homeLoanInterest)
        },
        hra,
        updatedAt: new Date()
    };
}

export const EMPTY_TAX_DECLARATION = () => sanitizeTaxDeclarationInput({});
