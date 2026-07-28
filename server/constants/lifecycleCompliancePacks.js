/**
 * India compliance pack definitions — installable feature bundles.
 * Full compliance workflows are Phase 1+; Phase 0 provides configurable foundation only.
 */

export const LIFECYCLE_COMPLIANCE_PACKS = Object.freeze([
    {
        key: 'compliance.india.core',
        label: 'India Core Identity & Statutory',
        description: 'Aadhaar, PAN, UAN, EPF, ESI, nomination, and digital consent.',
        features: [
            'compliance.india.aadhaar',
            'compliance.india.pan',
            'compliance.india.uan',
            'compliance.india.epf',
            'compliance.india.esi',
            'compliance.india.nomination',
            'compliance.india.digitalConsent',
        ],
        documentKeys: ['AADHAAR', 'PAN', 'UAN_DOCUMENT', 'PF_FORM', 'ESI_FORM', 'NOMINEE_FORM', 'DIGITAL_CONSENT'],
    },
    {
        key: 'compliance.india.tax',
        label: 'India Tax & Payroll Compliance',
        description: 'Professional tax, LWF, Form 16, and investment declaration.',
        features: [
            'compliance.india.professionalTax',
            'compliance.india.lwf',
            'compliance.india.form16',
            'compliance.india.investmentDeclaration',
        ],
        documentKeys: ['INVESTMENT_DECLARATION'],
    },
    {
        key: 'compliance.india.gratuity',
        label: 'India Gratuity',
        description: 'Gratuity nomination and eligibility tracking foundation.',
        features: ['compliance.india.gratuity'],
        documentKeys: ['NOMINEE_FORM'],
    },
    {
        key: 'compliance.india.labour',
        label: 'State Labour & Shops Act',
        description: 'State-specific labour compliance and Shops & Establishment foundation.',
        features: [
            'compliance.india.stateLabour',
            'compliance.india.shopsEstablishment',
        ],
        documentKeys: [],
    },
    {
        key: 'compliance.us.core',
        label: 'United States Core',
        description: 'I-9, W-4, at-will acknowledgment, and E-Verify foundation.',
        countries: ['US', 'USA', 'United States'],
        features: [
            'compliance.us.i9',
            'compliance.us.w4',
            'compliance.us.atWill',
            'compliance.us.everify',
        ],
        documentKeys: ['I9_FORM', 'W4_FORM', 'AT_WILL_ACK'],
    },
    {
        key: 'compliance.uk.core',
        label: 'United Kingdom Core',
        description: 'Right to Work, P45, and HMRC fields.',
        countries: ['UK', 'GB', 'United Kingdom', 'Great Britain'],
        features: [
            'compliance.uk.rightToWork',
            'compliance.uk.p45',
            'compliance.uk.hmrc',
        ],
        documentKeys: ['RIGHT_TO_WORK', 'P45_FORM'],
    },
    {
        key: 'compliance.eu.core',
        label: 'European Union Core',
        description: 'Employee GDPR consent and works council notification.',
        countries: ['DE', 'FR', 'NL', 'EU', 'Germany', 'France', 'Netherlands'],
        features: [
            'compliance.eu.gdprConsent',
            'compliance.eu.worksCouncil',
        ],
        documentKeys: ['GDPR_CONSENT'],
    },
    {
        key: 'compliance.me.core',
        label: 'Middle East Core',
        description: 'Labour card, visa, iqama, sponsorship, and exit permit.',
        countries: ['AE', 'SA', 'QA', 'BH', 'OM', 'KW', 'UAE', 'Saudi Arabia', 'Qatar'],
        features: [
            'compliance.me.labourCard',
            'compliance.me.visa',
            'compliance.me.iqama',
            'compliance.me.sponsorship',
            'compliance.me.exitPermit',
        ],
        documentKeys: ['LABOUR_CARD', 'VISA_DOCUMENT', 'IQAMA'],
    },
]);

/** Compliance-specific features for the registry */
export const LIFECYCLE_COMPLIANCE_FEATURES = Object.freeze([
    { key: 'compliance.india.aadhaar', label: 'Aadhaar Compliance', module: 'onboarding', category: 'compliance', defaultEnabled: false, packKey: 'compliance.india.core' },
    { key: 'compliance.india.pan', label: 'PAN Compliance', module: 'onboarding', category: 'compliance', defaultEnabled: false, packKey: 'compliance.india.core' },
    { key: 'compliance.india.uan', label: 'UAN Registration', module: 'onboarding', category: 'compliance', defaultEnabled: false, packKey: 'compliance.india.core' },
    { key: 'compliance.india.epf', label: 'EPF / PF Compliance', module: 'onboarding', category: 'compliance', defaultEnabled: false, packKey: 'compliance.india.core' },
    { key: 'compliance.india.esi', label: 'ESI Compliance', module: 'onboarding', category: 'compliance', defaultEnabled: false, packKey: 'compliance.india.core' },
    { key: 'compliance.india.professionalTax', label: 'Professional Tax', module: 'onboarding', category: 'compliance', defaultEnabled: false, packKey: 'compliance.india.tax' },
    { key: 'compliance.india.lwf', label: 'Labour Welfare Fund', module: 'onboarding', category: 'compliance', defaultEnabled: false, packKey: 'compliance.india.tax' },
    { key: 'compliance.india.gratuity', label: 'Gratuity', module: 'onboarding', category: 'compliance', defaultEnabled: false, packKey: 'compliance.india.gratuity' },
    { key: 'compliance.india.form16', label: 'Form 16', module: 'onboarding', category: 'compliance', defaultEnabled: false, packKey: 'compliance.india.tax' },
    { key: 'compliance.india.investmentDeclaration', label: 'Investment Declaration', module: 'onboarding', category: 'compliance', defaultEnabled: false, packKey: 'compliance.india.tax' },
    { key: 'compliance.india.nomination', label: 'Nomination Forms', module: 'onboarding', category: 'compliance', defaultEnabled: false, packKey: 'compliance.india.core' },
    { key: 'compliance.india.digitalConsent', label: 'Digital Consent', module: 'onboarding', category: 'compliance', defaultEnabled: false, packKey: 'compliance.india.core' },
    { key: 'compliance.india.stateLabour', label: 'State Labour Compliance', module: 'onboarding', category: 'compliance', defaultEnabled: false, packKey: 'compliance.india.labour' },
    { key: 'compliance.india.shopsEstablishment', label: 'Shops & Establishment', module: 'onboarding', category: 'compliance', defaultEnabled: false, packKey: 'compliance.india.labour' },
    { key: 'compliance.us.i9', label: 'I-9 Employment Eligibility', module: 'onboarding', category: 'compliance', defaultEnabled: false, packKey: 'compliance.us.core' },
    { key: 'compliance.us.w4', label: 'W-4 Tax Withholding', module: 'onboarding', category: 'compliance', defaultEnabled: false, packKey: 'compliance.us.core' },
    { key: 'compliance.us.atWill', label: 'At-Will Employment Acknowledgment', module: 'onboarding', category: 'compliance', defaultEnabled: false, packKey: 'compliance.us.core' },
    { key: 'compliance.us.everify', label: 'E-Verify', module: 'onboarding', category: 'compliance', defaultEnabled: false, packKey: 'compliance.us.core' },
    { key: 'compliance.uk.rightToWork', label: 'Right to Work', module: 'onboarding', category: 'compliance', defaultEnabled: false, packKey: 'compliance.uk.core' },
    { key: 'compliance.uk.p45', label: 'P45 Generation', module: 'offboarding', category: 'compliance', defaultEnabled: false, packKey: 'compliance.uk.core' },
    { key: 'compliance.uk.hmrc', label: 'HMRC Fields', module: 'onboarding', category: 'compliance', defaultEnabled: false, packKey: 'compliance.uk.core' },
    { key: 'compliance.eu.gdprConsent', label: 'Employee GDPR Consent', module: 'onboarding', category: 'compliance', defaultEnabled: false, packKey: 'compliance.eu.core' },
    { key: 'compliance.eu.worksCouncil', label: 'Works Council Notification', module: 'onboarding', category: 'compliance', defaultEnabled: false, packKey: 'compliance.eu.core' },
    { key: 'compliance.me.labourCard', label: 'Labour Card', module: 'onboarding', category: 'compliance', defaultEnabled: false, packKey: 'compliance.me.core' },
    { key: 'compliance.me.visa', label: 'Visa Linkage', module: 'onboarding', category: 'compliance', defaultEnabled: false, packKey: 'compliance.me.core' },
    { key: 'compliance.me.iqama', label: 'Iqama / Work Permit', module: 'onboarding', category: 'compliance', defaultEnabled: false, packKey: 'compliance.me.core' },
    { key: 'compliance.me.sponsorship', label: 'Sponsorship Linkage', module: 'onboarding', category: 'compliance', defaultEnabled: false, packKey: 'compliance.me.core' },
    { key: 'compliance.me.exitPermit', label: 'Exit Permit', module: 'offboarding', category: 'compliance', defaultEnabled: false, packKey: 'compliance.me.core' },
]);

const packMap = new Map(LIFECYCLE_COMPLIANCE_PACKS.map((p) => [p.key, p]));

export function getCompliancePack(key) {
    return packMap.get(key) || null;
}
