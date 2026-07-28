/**
 * White-label branding for lifecycle artifacts — letters, emails, portals.
 */

import Organization from '../models/organization.model.js';
import { getOrCreateLifecycleSettings } from './lifecycleConfigService.js';

export async function getOrganizationBranding(organizationId) {
    const org = await Organization.findById(organizationId)
        .select('name logo branding address website email')
        .lean();
    const settings = await getOrCreateLifecycleSettings(organizationId);
    const lifecycleBranding = settings.lifecycleBranding || {};

    return {
        companyName: org?.name || 'Company',
        logoUrl: lifecycleBranding.logoUrl || org?.logo || null,
        primaryColor: lifecycleBranding.primaryColor || org?.branding?.primaryColor || '#2563eb',
        secondaryColor: lifecycleBranding.secondaryColor || org?.branding?.secondaryColor || '#64748b',
        accentColor: lifecycleBranding.accentColor || org?.branding?.accentColor || '#0ea5e9',
        emailFromName: lifecycleBranding.emailFromName || org?.name,
        emailFooterHtml: lifecycleBranding.emailFooterHtml || `<p>© ${org?.name || 'Company'}</p>`,
        letterHeaderHtml: lifecycleBranding.letterHeaderHtml || `<p><strong>{{companyName}}</strong></p>`,
        portalWelcomeMessage: lifecycleBranding.portalWelcomeMessage || `Welcome to ${org?.name || 'our'} portal`,
        customDomain: lifecycleBranding.customDomain || null,
    };
}

export async function updateLifecycleBranding(organizationId, patch) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    settings.lifecycleBranding = { ...(settings.lifecycleBranding || {}), ...patch };
    settings.markModified('lifecycleBranding');
    await settings.save();
    return getOrganizationBranding(organizationId);
}

export function applyBrandingToLetterHtml(html, branding = {}) {
    const data = {
        companyName: branding.companyName || '',
        logoUrl: branding.logoUrl || '',
        primaryColor: branding.primaryColor || '#2563eb',
    };
    let result = html || '';
    for (const [key, value] of Object.entries(data)) {
        result = result.split(`{{${key}}}`).join(value ?? '');
    }
    if (branding.letterHeaderHtml && !result.includes(branding.companyName)) {
        result = branding.letterHeaderHtml.replace(/\{\{companyName\}\}/g, branding.companyName) + result;
    }
    return result;
}

export function buildBrandedEmailWrapper({ subject, bodyHtml, branding }) {
    return `
<!DOCTYPE html><html><head><meta charset="utf-8"><title>${subject}</title></head>
<body style="font-family:Arial,sans-serif;color:#333;max-width:640px;margin:0 auto">
  <div style="border-bottom:4px solid ${branding.primaryColor};padding:16px 0">
    ${branding.logoUrl ? `<img src="${branding.logoUrl}" alt="${branding.companyName}" height="40"/>` : `<strong>${branding.companyName}</strong>`}
  </div>
  <div style="padding:24px 0">${bodyHtml}</div>
  <div style="font-size:12px;color:#666;border-top:1px solid #eee;padding-top:16px">${branding.emailFooterHtml || ''}</div>
</body></html>`;
}
