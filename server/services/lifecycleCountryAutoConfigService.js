/**
 * Country / industry auto-detection and compliance pack auto-install.
 */

import Organization from '../models/organization.model.js';
import { LIFECYCLE_COMPLIANCE_PACKS } from '../constants/lifecycleCompliancePacks.js';
import { LIFECYCLE_INDUSTRY_PACKS } from '../constants/lifecycleIndustryPacks.js';
import { installCompliancePack, installIndustryPack } from './lifecycleConfigService.js';
import { logLifecycleAudit } from './lifecycleAuditService.js';

const COUNTRY_ALIASES = Object.freeze({
    IN: ['IN', 'IND', 'INDIA', 'INDIAN'],
    US: ['US', 'USA', 'UNITED STATES', 'AMERICA'],
    UK: ['UK', 'GB', 'GBR', 'UNITED KINGDOM', 'GREAT BRITAIN', 'ENGLAND'],
    AE: ['AE', 'UAE', 'UNITED ARAB EMIRATES', 'DUBAI', 'ABU DHABI'],
    SA: ['SA', 'SAU', 'SAUDI ARABIA', 'KSA'],
    DE: ['DE', 'DEU', 'GERMANY'],
    FR: ['FR', 'FRA', 'FRANCE'],
});

const INDUSTRY_TO_PACK = Object.freeze({
    IT: 'industry.it',
    Healthcare: 'industry.healthcare',
    Manufacturing: 'industry.manufacturing',
    Finance: 'industry.bfsi',
    Retail: 'industry.retail',
    Hospitality: 'industry.hospitality',
    Construction: 'industry.construction',
    Education: 'industry.education',
});

function normalize(value) {
    return String(value || '').trim().toUpperCase();
}

export function resolveCountryCode(org) {
    const country = normalize(org?.address?.country || org?.country);
    if (!country) return null;
    for (const [code, aliases] of Object.entries(COUNTRY_ALIASES)) {
        if (aliases.some((a) => country === a || country.includes(a))) return code;
    }
    if (['DE', 'FR', 'NL', 'IT', 'ES', 'BE', 'PL', 'SE'].includes(country)) return 'EU';
    return country.length === 2 ? country : null;
}

export function resolveCompliancePacksForCountry(countryCode) {
    if (!countryCode) return [];
    const code = normalize(countryCode);
    if (code === 'IN') return ['compliance.india.core', 'compliance.india.tax'];
    if (code === 'US') return ['compliance.us.core'];
    if (code === 'UK' || code === 'GB') return ['compliance.uk.core'];
    if (code === 'EU' || ['DE', 'FR', 'NL'].includes(code)) return ['compliance.eu.core'];
    if (['AE', 'SA', 'QA', 'BH', 'OM', 'KW'].includes(code)) return ['compliance.me.core'];
    return LIFECYCLE_COMPLIANCE_PACKS
        .filter((p) => (p.countries || []).some((c) => normalize(c) === code))
        .map((p) => p.key);
}

export function resolveIndustryPackForOrg(org) {
    const industry = org?.industry;
    if (!industry) return null;
    const direct = INDUSTRY_TO_PACK[industry];
    if (direct) return direct;
    const pack = LIFECYCLE_INDUSTRY_PACKS.find((p) => normalize(p.industry) === normalize(industry));
    return pack?.key || null;
}

export async function autoConfigureLifecyclePacks(organizationId, { actor = null, req = null, force = false } = {}) {
    const org = await Organization.findById(organizationId)
        .select('industry address country')
        .lean();
    if (!org) throw new Error('Organization not found');

    const { getOrCreateLifecycleSettings } = await import('./lifecycleConfigService.js');
    const settings = await getOrCreateLifecycleSettings(organizationId);

    const countryCode = resolveCountryCode(org);
    const compliancePackKeys = resolveCompliancePacksForCountry(countryCode);
    const industryPackKey = resolveIndustryPackForOrg(org);
    const installed = { compliance: [], industry: null };

    for (const packKey of compliancePackKeys) {
        const existing = (settings.compliancePacks || []).find((p) => p.packKey === packKey);
        // Respect explicit user disable in Configure — don't re-install on bootstrap
        if (existing && existing.enabled === false && !force) continue;
        try {
            await installCompliancePack(organizationId, packKey, { req, actor });
            installed.compliance.push(packKey);
        } catch (err) {
            if (force) throw err;
        }
    }

    if (industryPackKey) {
        const existing = (settings.industryPacks || []).find((p) => p.packKey === industryPackKey);
        if (!(existing && existing.enabled === false && !force)) {
            try {
                await installIndustryPack(organizationId, industryPackKey, { req, actor });
                installed.industry = industryPackKey;
            } catch (err) {
                if (force) throw err;
            }
        }
    }

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'LifecycleSettings',
        entityId: organizationId,
        entityName: 'Auto Country/Industry Pack Configuration',
        req,
        actor,
        metadata: { countryCode, installed },
    });

    return { countryCode, ...installed };
}
