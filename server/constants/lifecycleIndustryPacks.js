/**
 * Industry pack definitions — installable template + feature bundles.
 * No industry logic is hardcoded in services; packs only seed configuration.
 */

export const LIFECYCLE_INDUSTRY_PACKS = Object.freeze([
    {
        key: 'industry.it',
        label: 'IT & Software',
        description: 'NDA, IP agreements, GitHub/GitLab access, laptop & software allocation.',
        industry: 'IT',
        features: [
            'industry.it.nda',
            'industry.it.ipAgreement',
            'industry.it.repositoryAccess',
            'industry.it.laptopAllocation',
            'industry.it.softwareAllocation',
        ],
    },
    {
        key: 'industry.healthcare',
        label: 'Healthcare',
        description: 'Medical license verification and professional credential tracking.',
        industry: 'Healthcare',
        features: [
            'industry.healthcare.license',
            'industry.healthcare.credentials',
        ],
    },
    {
        key: 'industry.manufacturing',
        label: 'Manufacturing',
        description: 'Safety training, PPE allocation, and machine authorization.',
        industry: 'Manufacturing',
        features: [
            'industry.manufacturing.safetyTraining',
            'industry.manufacturing.ppeAllocation',
            'industry.manufacturing.machineAuthorization',
        ],
    },
    {
        key: 'industry.bfsi',
        label: 'BFSI',
        description: 'AML/KYC verification and regulatory approvals.',
        industry: 'Finance',
        features: [
            'industry.bfsi.amlKyc',
            'industry.bfsi.regulatoryApproval',
        ],
    },
    {
        key: 'industry.retail',
        label: 'Retail & Hospitality',
        description: 'Bulk hiring, fast-track onboarding, seasonal employee support.',
        industry: 'Retail',
        features: [
            'industry.retail.bulkHiring',
            'industry.retail.fastTrackOnboarding',
            'industry.retail.seasonalEmployee',
        ],
    },
    {
        key: 'industry.hospitality',
        label: 'Hospitality',
        description: 'Seasonal staffing and fast-track onboarding for hospitality.',
        industry: 'Hospitality',
        features: [
            'industry.retail.fastTrackOnboarding',
            'industry.retail.seasonalEmployee',
        ],
    },
    {
        key: 'industry.construction',
        label: 'Construction',
        description: 'Site safety induction, contractor classification, safety certifications.',
        industry: 'Construction',
        features: [
            'industry.construction.siteSafety',
            'industry.construction.contractorClassification',
            'industry.construction.safetyCertification',
        ],
    },
    {
        key: 'industry.education',
        label: 'Education',
        description: 'Faculty credential verification and child safety background checks.',
        industry: 'Education',
        features: [
            'industry.education.facultyCredentials',
            'industry.education.childSafetyBgv',
        ],
    },
]);

/** Industry-specific features registered in the feature registry extension */
export const LIFECYCLE_INDUSTRY_FEATURES = Object.freeze(
    LIFECYCLE_INDUSTRY_PACKS.flatMap((pack) =>
        pack.features.map((key) => ({
            key,
            label: key.split('.').slice(-1)[0].replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
            module: 'onboarding',
            category: 'industry',
            defaultEnabled: false,
            packKey: pack.key,
        })),
    ),
);

const packMap = new Map(LIFECYCLE_INDUSTRY_PACKS.map((p) => [p.key, p]));

export function getIndustryPack(key) {
    return packMap.get(key) || null;
}
