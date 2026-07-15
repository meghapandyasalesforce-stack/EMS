/**
 * Indian income tax (TDS) — Old vs New regime (FY 2025-26).
 * Includes individual surcharge (with marginal relief) + 4% cess.
 */

export const TAX_REGIME = {
    OLD: 'old',
    NEW: 'new'
};

const CESS_RATE = 0.04;
const SECTION_80C_LIMIT = 150000;
const SECTION_24B_HOME_LOAN_LIMIT = 200000;

const STANDARD_DEDUCTION = {
    [TAX_REGIME.OLD]: 50000,
    [TAX_REGIME.NEW]: 75000
};

const OLD_REGIME_SLABS = [
    { upto: 250000, rate: 0 },
    { upto: 500000, rate: 0.05 },
    { upto: 1000000, rate: 0.2 },
    { upto: Infinity, rate: 0.3 }
];

const NEW_REGIME_SLABS = [
    { upto: 400000, rate: 0 },
    { upto: 800000, rate: 0.05 },
    { upto: 1200000, rate: 0.1 },
    { upto: 1600000, rate: 0.15 },
    { upto: 2000000, rate: 0.2 },
    { upto: 2400000, rate: 0.25 },
    { upto: Infinity, rate: 0.3 }
];

/**
 * Individual surcharge bands on taxable income.
 * New regime caps the top surcharge at 25% (Budget 2023).
 * `upto` is inclusive for that band; `rate` applies when income is in
 * (previous upto, this upto].
 */
const SURCHARGE_BANDS_OLD = [
    { upto: 5000000, rate: 0 },
    { upto: 10000000, rate: 0.1 },
    { upto: 20000000, rate: 0.15 },
    { upto: 50000000, rate: 0.25 },
    { upto: Infinity, rate: 0.37 }
];

const SURCHARGE_BANDS_NEW = [
    { upto: 5000000, rate: 0 },
    { upto: 10000000, rate: 0.1 },
    { upto: 20000000, rate: 0.15 },
    { upto: 50000000, rate: 0.25 },
    { upto: Infinity, rate: 0.25 }
];

export function normalizeTaxRegime(value) {
    const v = String(value || '').trim().toLowerCase();
    if (v === 'old' || v === 'old regime' || v === 'old_regime') return TAX_REGIME.OLD;
    if (v === 'new' || v === 'new regime' || v === 'new_regime') return TAX_REGIME.NEW;
    return TAX_REGIME.NEW;
}

export function formatTaxRegimeLabel(regime) {
    return normalizeTaxRegime(regime) === TAX_REGIME.OLD ? 'Old' : 'New';
}

/** India FY label e.g. "2026-27" for a given date (April–March). */
export function getIndianFinancialYear(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    const month = d.getMonth();
    const year = d.getFullYear();
    const startYear = month >= 3 ? year : year - 1;
    const endYear = (startYear + 1) % 100;
    return `${startYear}-${String(endYear).padStart(2, '0')}`;
}

function asNonNegativeNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

function applySlabs(taxableIncome, slabs) {
    const income = Math.max(0, taxableIncome);
    let tax = 0;
    let previousLimit = 0;

    for (const slab of slabs) {
        if (income <= previousLimit) break;
        const upper = slab.upto === Infinity ? income : Math.min(income, slab.upto);
        const amountInSlab = upper - previousLimit;
        if (amountInSlab > 0) tax += amountInSlab * slab.rate;
        previousLimit = slab.upto === Infinity ? income : slab.upto;
    }

    return tax;
}

function applyRebate87A(tax, regime, totalIncome) {
    if (tax <= 0) return 0;

    if (regime === TAX_REGIME.NEW) {
        if (totalIncome <= 1200000) {
            return Math.max(0, tax - Math.min(tax, 60000));
        }
        return tax;
    }

    if (totalIncome <= 500000) {
        return Math.max(0, tax - Math.min(tax, 12500));
    }

    return tax;
}

function getSurchargeBands(regime) {
    return regime === TAX_REGIME.NEW ? SURCHARGE_BANDS_NEW : SURCHARGE_BANDS_OLD;
}

/**
 * Resolve surcharge rate and the lower threshold of the active band.
 */
export function resolveSurchargeBand(taxableIncome, regime = TAX_REGIME.OLD) {
    const income = Math.max(0, Number(taxableIncome) || 0);
    const bands = getSurchargeBands(normalizeTaxRegime(regime));
    let previousLimit = 0;

    for (const band of bands) {
        if (income <= band.upto) {
            return { rate: band.rate, threshold: previousLimit };
        }
        previousLimit = band.upto === Infinity ? previousLimit : band.upto;
    }

    return { rate: 0, threshold: 0 };
}

/** Slab tax + 87A rebate only (before surcharge / cess). */
export function computeTaxBeforeSurcharge(taxableIncome, regime) {
    const normalized = normalizeTaxRegime(regime);
    const income = Math.max(0, Number(taxableIncome) || 0);
    const slabs = normalized === TAX_REGIME.NEW ? NEW_REGIME_SLABS : OLD_REGIME_SLABS;
    const baseTax = applySlabs(income, slabs);
    return applyRebate87A(baseTax, normalized, income);
}

/**
 * Surcharge on income tax with marginal relief near band thresholds.
 * Relief caps tax+surcharge so the jump past the threshold never exceeds
 * the income increase itself.
 */
export function computeSurcharge(taxAfterRebate, taxableIncome, regime = TAX_REGIME.OLD) {
    const tax = Math.max(0, Number(taxAfterRebate) || 0);
    const income = Math.max(0, Number(taxableIncome) || 0);
    const normalized = normalizeTaxRegime(regime);
    const { rate, threshold } = resolveSurchargeBand(income, normalized);

    if (tax <= 0 || rate <= 0) return 0;

    const rawSurcharge = tax * rate;
    const taxAtThreshold = threshold > 0 ? computeTaxBeforeSurcharge(threshold, normalized) : 0;
    const maxTaxPlusSurcharge = taxAtThreshold + Math.max(0, income - threshold);
    const cappedTotal = Math.min(tax + rawSurcharge, maxTaxPlusSurcharge);
    return Math.max(0, cappedTotal - tax);
}

function finalizeAnnualTax(taxAfterRebate, taxableIncome, regime) {
    const surcharge = computeSurcharge(taxAfterRebate, taxableIncome, regime);
    return Math.round((taxAfterRebate + surcharge) * (1 + CESS_RATE));
}

/**
 * HRA exemption under old regime (Section 10(13A)).
 */
export function computeHraExemption({
    annualHra = 0,
    annualBasic = 0,
    rentPaidAnnual = 0,
    metroCity = false
}) {
    const hra = Math.max(0, annualHra);
    const basic = Math.max(0, annualBasic);
    const rent = Math.max(0, rentPaidAnnual);

    if (!hra || !rent) return 0;

    const rentMinusTenPercentBasic = Math.max(0, rent - basic * 0.1);
    const percentOfBasic = basic * (metroCity ? 0.5 : 0.4);

    return Math.round(Math.min(hra, rentMinusTenPercentBasic, percentOfBasic));
}

/**
 * Declared 80C investments (excludes PF — merged separately).
 */
export function sumDeclaredSection80C(section80C = {}) {
    const src = section80C && typeof section80C === 'object' ? section80C : {};
    return (
        asNonNegativeNumber(src.ppf) +
        asNonNegativeNumber(src.lic) +
        asNonNegativeNumber(src.elss) +
        asNonNegativeNumber(src.tuitionFees) +
        asNonNegativeNumber(src.homeLoanPrincipal) +
        asNonNegativeNumber(src.other)
    );
}

/**
 * Total 80C including employee PF (capped at ₹1.5L).
 */
export function computeSection80CTotal({ annualPfEmployee = 0, section80C = {} }) {
    const declared = sumDeclaredSection80C(section80C);
    return Math.min(SECTION_80C_LIMIT, asNonNegativeNumber(annualPfEmployee) + declared);
}

/**
 * Section 80D with age-based caps.
 */
export function computeSection80D(section80D = {}) {
    const src = section80D && typeof section80D === 'object' ? section80D : {};
    const selfCap = src.selfSeniorCitizen ? 50000 : 25000;
    const parentsCap = src.parentsSeniorCitizen ? 50000 : 25000;

    const self = Math.min(selfCap, asNonNegativeNumber(src.selfFamilyPremium));
    const parents = Math.min(parentsCap, asNonNegativeNumber(src.parentsPremium));

    return self + parents;
}

export function resolveTaxDeclaration(emp, { month, year } = {}) {
    const fin = emp?.financialDetails || {};
    const declaration = fin.taxDeclaration || {};
    const hra = declaration.hra || {};

    const payrollFy = month != null && year != null
        ? getIndianFinancialYear(new Date(`${month} 1, ${year}`))
        : getIndianFinancialYear();
    const declarationFy = declaration.financialYear ? String(declaration.financialYear).trim() : '';
    const useDeclaration = Boolean(declarationFy && declarationFy === payrollFy);

    if (!useDeclaration) {
        return {
            section80C: {},
            section80D: {},
            section80E: 0,
            section24b: 0,
            monthlyRent: 0,
            metroCity: Boolean(fin.metroCity)
        };
    }

    return {
        section80C: declaration.section80C || {},
        section80D: declaration.section80D || {},
        section80E: asNonNegativeNumber(declaration.section80E?.educationLoanInterest),
        section24b: Math.min(
            SECTION_24B_HOME_LOAN_LIMIT,
            asNonNegativeNumber(declaration.section24b?.homeLoanInterest)
        ),
        monthlyRent: asNonNegativeNumber(hra.monthlyRent),
        metroCity: Boolean(hra.metroCity ?? fin.metroCity)
    };
}

/**
 * Annual income tax (slab tax − rebate + surcharge + 4% cess).
 */
export function computeAnnualIncomeTax({
    taxRegime,
    annualGrossIncome = 0,
    annualBasic = 0,
    annualHra = 0,
    annualPfEmployee = 0,
    annualProfessionalTax = 0,
    section80C = {},
    section80D = {},
    section80E = 0,
    section24b = 0,
    monthlyRent = 0,
    metroCity = false
}) {
    const regime = normalizeTaxRegime(taxRegime);
    const gross = Math.max(0, annualGrossIncome);

    if (regime === TAX_REGIME.NEW) {
        const totalIncome = Math.max(0, gross - STANDARD_DEDUCTION[TAX_REGIME.NEW]);
        const afterRebate = computeTaxBeforeSurcharge(totalIncome, TAX_REGIME.NEW);
        return finalizeAnnualTax(afterRebate, totalIncome, TAX_REGIME.NEW);
    }

    const section80cTotal = computeSection80CTotal({ annualPfEmployee, section80C });
    const section80dTotal = computeSection80D(section80D);
    const hraExemption = computeHraExemption({
        annualHra,
        annualBasic,
        rentPaidAnnual: monthlyRent * 12,
        metroCity
    });
    const profTax = Math.max(0, annualProfessionalTax);

    const totalIncome = Math.max(
        0,
        gross -
            STANDARD_DEDUCTION[TAX_REGIME.OLD] -
            section80cTotal -
            section80dTotal -
            asNonNegativeNumber(section80E) -
            asNonNegativeNumber(section24b) -
            hraExemption -
            profTax
    );

    const afterRebate = computeTaxBeforeSurcharge(totalIncome, TAX_REGIME.OLD);
    return finalizeAnnualTax(afterRebate, totalIncome, TAX_REGIME.OLD);
}

export function computeMonthlyIncomeTax(params) {
    const annualTax = computeAnnualIncomeTax(params);
    return Math.round(annualTax / 12);
}

export function resolveEmployeeTaxRegime(emp) {
    return emp?.financialDetails?.taxRegime || emp?.taxRegime || '';
}

export function buildIncomeTaxParamsFromEmployee(emp, { annualGross, annualBasic, annualHra, annualPfEmployee, annualProfessionalTax, month, year }) {
    const declaration = resolveTaxDeclaration(emp, { month, year });

    return {
        taxRegime: resolveEmployeeTaxRegime(emp),
        annualGrossIncome: annualGross,
        annualBasic,
        annualHra,
        annualPfEmployee,
        annualProfessionalTax,
        section80C: declaration.section80C,
        section80D: declaration.section80D,
        section80E: declaration.section80E,
        section24b: declaration.section24b,
        monthlyRent: declaration.monthlyRent,
        metroCity: declaration.metroCity
    };
}
