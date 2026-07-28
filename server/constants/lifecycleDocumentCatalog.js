/**
 * System-wide document catalog — orgs override via LifecycleDocumentCatalogEntry.
 * Each entry maps to a lifecycle feature for gating.
 */

export const LIFECYCLE_DOCUMENT_HUB_CATEGORIES = Object.freeze([
    'Identity',
    'Education',
    'Experience',
    'Address',
    'Employment',
    'Financial',
    'Compliance',
    'Medical',
    'Assets',
    'Custom',
]);

const catalogEntry = (entry) => Object.freeze(entry);

export const LIFECYCLE_DOCUMENT_CATALOG = Object.freeze([
    catalogEntry({ key: 'AADHAAR', label: 'Aadhaar Card', hubCategory: 'Identity', module: 'onboarding', featureKey: 'compliance.india.aadhaar', mandatory: true, approvalRequired: true, versioningEnabled: true, indiaCompliance: true }),
    catalogEntry({ key: 'PAN', label: 'PAN Card', hubCategory: 'Identity', module: 'onboarding', featureKey: 'compliance.india.pan', mandatory: true, approvalRequired: true, versioningEnabled: true, indiaCompliance: true }),
    catalogEntry({ key: 'PASSPORT', label: 'Passport', hubCategory: 'Identity', module: 'onboarding', featureKey: 'documentCollection', mandatory: false, approvalRequired: true, expiryDays: 3650, renewalReminderDays: 90, versioningEnabled: true }),
    catalogEntry({ key: 'DRIVING_LICENSE', label: 'Driving License', hubCategory: 'Identity', module: 'onboarding', featureKey: 'documentCollection', mandatory: false, approvalRequired: true, expiryDays: 1825, renewalReminderDays: 60, versioningEnabled: true }),
    catalogEntry({ key: 'VOTER_ID', label: 'Voter ID', hubCategory: 'Identity', module: 'onboarding', featureKey: 'documentCollection', mandatory: false, approvalRequired: true, versioningEnabled: true, indiaCompliance: true }),
    catalogEntry({ key: 'PHOTO', label: 'Photograph', hubCategory: 'Identity', module: 'onboarding', featureKey: 'documentCollection', mandatory: true, approvalRequired: false, versioningEnabled: true }),
    catalogEntry({ key: 'SIGNATURE', label: 'Signature', hubCategory: 'Identity', module: 'onboarding', featureKey: 'documentCollection', mandatory: true, approvalRequired: false, versioningEnabled: true }),
    catalogEntry({ key: 'ADDRESS_PROOF', label: 'Address Proof', hubCategory: 'Address', module: 'onboarding', featureKey: 'documentCollection', mandatory: false, approvalRequired: true, versioningEnabled: true }),
    catalogEntry({ key: 'DEGREE', label: 'Degree Certificate', hubCategory: 'Education', module: 'onboarding', featureKey: 'documentCollection', mandatory: true, approvalRequired: true, versioningEnabled: true }),
    catalogEntry({ key: 'DIPLOMA', label: 'Diploma', hubCategory: 'Education', module: 'onboarding', featureKey: 'documentCollection', mandatory: false, approvalRequired: true, versioningEnabled: true }),
    catalogEntry({ key: 'EXPERIENCE', label: 'Experience Letter', hubCategory: 'Experience', module: 'onboarding', featureKey: 'documentCollection', mandatory: false, approvalRequired: true, versioningEnabled: true }),
    catalogEntry({ key: 'RESUME', label: 'Resume / CV', hubCategory: 'Employment', module: 'onboarding', featureKey: 'documentCollection', mandatory: false, approvalRequired: false, versioningEnabled: true }),
    catalogEntry({ key: 'BANK_PASSBOOK', label: 'Bank Passbook', hubCategory: 'Financial', module: 'onboarding', featureKey: 'bankDetails', mandatory: false, approvalRequired: true, versioningEnabled: true, indiaCompliance: true }),
    catalogEntry({ key: 'BANK_DETAILS', label: 'Cancelled Cheque', hubCategory: 'Financial', module: 'onboarding', featureKey: 'bankDetails', mandatory: true, approvalRequired: true, versioningEnabled: true }),
    catalogEntry({ key: 'SALARY_SLIP', label: 'Salary Slip', hubCategory: 'Financial', module: 'onboarding', featureKey: 'documentCollection', mandatory: false, approvalRequired: true, versioningEnabled: true }),
    catalogEntry({ key: 'OFFER_LETTER', label: 'Offer Letter', hubCategory: 'Employment', module: 'onboarding', featureKey: 'offerLetter', mandatory: true, approvalRequired: true, versioningEnabled: true }),
    catalogEntry({ key: 'OFFER_ACK', label: 'Offer Letter Acknowledgement', hubCategory: 'Employment', module: 'onboarding', featureKey: 'offerLetter', mandatory: true, approvalRequired: true, versioningEnabled: true }),
    catalogEntry({ key: 'APPOINTMENT_LETTER', label: 'Appointment Letter', hubCategory: 'Employment', module: 'onboarding', featureKey: 'documentCollection', mandatory: false, approvalRequired: true, versioningEnabled: true }),
    catalogEntry({ key: 'NDA', label: 'Non-Disclosure Agreement', hubCategory: 'Compliance', module: 'onboarding', featureKey: 'industry.it.nda', mandatory: true, approvalRequired: false, versioningEnabled: true }),
    catalogEntry({ key: 'NOMINEE_FORM', label: 'Nomination Form', hubCategory: 'Compliance', module: 'onboarding', featureKey: 'compliance.india.nomination', mandatory: false, approvalRequired: true, versioningEnabled: true, indiaCompliance: true }),
    catalogEntry({ key: 'MEDICAL_CERTIFICATE', label: 'Medical Certificate', hubCategory: 'Medical', module: 'onboarding', featureKey: 'industry.healthcare.credentials', mandatory: false, approvalRequired: true, expiryDays: 365, renewalReminderDays: 30, versioningEnabled: true }),
    catalogEntry({ key: 'POLICE_VERIFICATION', label: 'Police Verification', hubCategory: 'Compliance', module: 'onboarding', featureKey: 'backgroundVerification', mandatory: false, approvalRequired: true, expiryDays: 730, renewalReminderDays: 60, versioningEnabled: true, indiaCompliance: true }),
    catalogEntry({ key: 'UAN_DOCUMENT', label: 'UAN Document', hubCategory: 'Compliance', module: 'onboarding', featureKey: 'compliance.india.uan', mandatory: false, approvalRequired: true, versioningEnabled: true, indiaCompliance: true }),
    catalogEntry({ key: 'PF_FORM', label: 'EPF Form 11', hubCategory: 'Compliance', module: 'onboarding', featureKey: 'compliance.india.epf', mandatory: false, approvalRequired: true, versioningEnabled: true, indiaCompliance: true }),
    catalogEntry({ key: 'ESI_FORM', label: 'ESI Registration Form', hubCategory: 'Compliance', module: 'onboarding', featureKey: 'compliance.india.esi', mandatory: false, approvalRequired: true, versioningEnabled: true, indiaCompliance: true }),
    catalogEntry({ key: 'INVESTMENT_DECLARATION', label: 'Investment Declaration', hubCategory: 'Financial', module: 'onboarding', featureKey: 'compliance.india.investmentDeclaration', mandatory: false, approvalRequired: true, versioningEnabled: true, indiaCompliance: true }),
    catalogEntry({ key: 'DIGITAL_CONSENT', label: 'Digital Consent Form', hubCategory: 'Compliance', module: 'onboarding', featureKey: 'compliance.india.digitalConsent', mandatory: false, approvalRequired: false, versioningEnabled: true, indiaCompliance: true }),
    catalogEntry({ key: 'I9_FORM', label: 'I-9 Employment Eligibility', hubCategory: 'Compliance', module: 'onboarding', featureKey: 'compliance.us.i9', mandatory: true, approvalRequired: true, versioningEnabled: true }),
    catalogEntry({ key: 'W4_FORM', label: 'W-4 Tax Withholding', hubCategory: 'Compliance', module: 'onboarding', featureKey: 'compliance.us.w4', mandatory: true, approvalRequired: true, versioningEnabled: true }),
    catalogEntry({ key: 'AT_WILL_ACK', label: 'At-Will Employment Acknowledgment', hubCategory: 'Compliance', module: 'onboarding', featureKey: 'compliance.us.atWill', mandatory: true, approvalRequired: false, versioningEnabled: true }),
    catalogEntry({ key: 'RIGHT_TO_WORK', label: 'Right to Work Evidence', hubCategory: 'Compliance', module: 'onboarding', featureKey: 'compliance.uk.rightToWork', mandatory: true, approvalRequired: true, expiryDays: 365, renewalReminderDays: 30, versioningEnabled: true }),
    catalogEntry({ key: 'P45_FORM', label: 'P45', hubCategory: 'Compliance', module: 'offboarding', featureKey: 'compliance.uk.p45', mandatory: true, approvalRequired: true, versioningEnabled: true }),
    catalogEntry({ key: 'GDPR_CONSENT', label: 'GDPR Employee Consent', hubCategory: 'Compliance', module: 'onboarding', featureKey: 'compliance.eu.gdprConsent', mandatory: true, approvalRequired: false, versioningEnabled: true }),
    catalogEntry({ key: 'LABOUR_CARD', label: 'Labour Card', hubCategory: 'Compliance', module: 'onboarding', featureKey: 'compliance.me.labourCard', mandatory: true, approvalRequired: true, expiryDays: 365, renewalReminderDays: 30, versioningEnabled: true }),
    catalogEntry({ key: 'VISA_DOCUMENT', label: 'Visa Document', hubCategory: 'Compliance', module: 'onboarding', featureKey: 'compliance.me.visa', mandatory: true, approvalRequired: true, expiryDays: 365, renewalReminderDays: 60, versioningEnabled: true }),
    catalogEntry({ key: 'IQAMA', label: 'Iqama / Work Permit', hubCategory: 'Compliance', module: 'onboarding', featureKey: 'compliance.me.iqama', mandatory: true, approvalRequired: true, expiryDays: 365, renewalReminderDays: 60, versioningEnabled: true }),
    catalogEntry({ key: 'EXPERIENCE_LETTER_ISSUED', label: 'Experience Letter (Issued)', hubCategory: 'Employment', module: 'offboarding', featureKey: 'experienceLetter', mandatory: true, approvalRequired: true, versioningEnabled: true }),
    catalogEntry({ key: 'RELIEVING_LETTER', label: 'Relieving Letter', hubCategory: 'Employment', module: 'offboarding', featureKey: 'relievingLetter', mandatory: true, approvalRequired: true, versioningEnabled: true }),
    catalogEntry({ key: 'SERVICE_CERTIFICATE', label: 'Service Certificate', hubCategory: 'Employment', module: 'offboarding', featureKey: 'serviceCertificate', mandatory: false, approvalRequired: true, versioningEnabled: true }),
    catalogEntry({ key: 'OTHER', label: 'Other Document', hubCategory: 'Custom', module: 'both', featureKey: 'documentCollection', mandatory: false, approvalRequired: false, versioningEnabled: true }),
]);

/** Maps catalog keys to legacy employeeJobDocumentType for backward compatibility */
export const CATALOG_TO_JOB_DOCUMENT_TYPE = Object.freeze({
    AADHAAR: 'AADHAR_CARD',
    PAN: 'PAN_CARD',
    DEGREE: 'DEGREE_CERTIFICATE',
    DIPLOMA: 'DEGREE_CERTIFICATE',
    OFFER_LETTER: 'OFFER_LETTER',
    OFFER_ACK: 'OFFER_LETTER',
    EXPERIENCE: 'OTHER',
    OTHER: 'OTHER',
});

const catalogMap = new Map(LIFECYCLE_DOCUMENT_CATALOG.map((d) => [d.key, d]));

export function getCatalogDocument(key) {
    return catalogMap.get(key) || null;
}

export function getCatalogByModule(module) {
    return LIFECYCLE_DOCUMENT_CATALOG.filter((d) => d.module === module || d.module === 'both');
}

export function getCatalogByCategory(hubCategory) {
    return LIFECYCLE_DOCUMENT_CATALOG.filter((d) => d.hubCategory === hubCategory);
}

export const LIFECYCLE_FORM_FIELD_TYPES = Object.freeze([
    'text', 'number', 'email', 'phone', 'date', 'dropdown', 'multiselect',
    'checkbox', 'radio', 'address', 'file', 'signature', 'richtext',
]);
