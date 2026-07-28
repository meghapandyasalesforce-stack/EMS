/**
 * Automated access revocation adapters — IdP, SaaS, VPN, HRMS.
 */

import logger from '../helpers/logger.js';
import { assertFeatureEnabled } from './lifecycleConfigService.js';

const adapters = new Map();

export function registerAccessRevocationAdapter(name, adapter) {
    adapters.set(name, adapter);
}

async function httpCall(url, options = {}) {
    const res = await fetch(url, options);
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = { raw: text }; }
    if (!res.ok) throw new Error(body.message || body.error || res.statusText);
    return body;
}

const SYSTEM_ADAPTER_MAP = Object.freeze({
    'Company email': 'google_workspace',
    'HRMS and internal applications': 'hrms',
    'VPN and network': 'vpn',
    'Building and ID card access': 'physical_access',
    GitHub: 'github',
    GitLab: 'gitlab',
    Slack: 'slack',
    Jira: 'jira',
    'Microsoft 365': 'microsoft365',
    Teams: 'microsoft365',
});

/** Azure AD / Microsoft Graph */
registerAccessRevocationAdapter('azure_ad', {
    async revoke({ userEmail, organizationId }) {
        const tenantId = process.env.AZURE_AD_TENANT_ID;
        const token = process.env.AZURE_AD_ACCESS_TOKEN;
        if (!tenantId || !token) throw new Error('Azure AD not configured');
        await httpCall(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userEmail)}`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ accountEnabled: false }),
        });
        return { success: true, system: 'azure_ad', revokedAt: new Date() };
    },
});

registerAccessRevocationAdapter('google_workspace', {
    async revoke({ userEmail }) {
        const token = process.env.GOOGLE_WORKSPACE_ACCESS_TOKEN;
        const customerId = process.env.GOOGLE_WORKSPACE_CUSTOMER_ID || 'my_customer';
        if (!token) throw new Error('Google Workspace not configured');
        await httpCall(`https://admin.googleapis.com/admin/directory/v1/users/${encodeURIComponent(userEmail)}`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ suspended: true }),
        });
        return { success: true, system: 'google_workspace', revokedAt: new Date() };
    },
});

registerAccessRevocationAdapter('okta', {
    async revoke({ userEmail }) {
        const domain = process.env.OKTA_DOMAIN;
        const token = process.env.OKTA_API_TOKEN;
        if (!domain || !token) throw new Error('Okta not configured');
        const users = await httpCall(`https://${domain}/api/v1/users?search=profile.email eq "${userEmail}"`, {
            headers: { Authorization: `SSWS ${token}` },
        });
        const user = users[0];
        if (!user) throw new Error('Okta user not found');
        await httpCall(`https://${domain}/api/v1/users/${user.id}/lifecycle/suspend`, {
            method: 'POST',
            headers: { Authorization: `SSWS ${token}` },
        });
        return { success: true, system: 'okta', revokedAt: new Date() };
    },
});

registerAccessRevocationAdapter('github', {
    async revoke({ userEmail, metadata }) {
        const token = process.env.GITHUB_ADMIN_TOKEN;
        const org = process.env.GITHUB_ORG || metadata?.githubOrg;
        if (!token || !org) throw new Error('GitHub org admin not configured');
        const username = metadata?.githubUsername;
        if (!username) return { success: false, system: 'github', message: 'GitHub username required' };
        await httpCall(`https://api.github.com/orgs/${org}/memberships/${username}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
        });
        return { success: true, system: 'github', revokedAt: new Date() };
    },
});

registerAccessRevocationAdapter('hrms', {
    async revoke({ employeeId, organizationId }) {
        const Employee = (await import('../models/employee.model.js')).default;
        await Employee.findOneAndUpdate(
            { _id: employeeId, organizationId },
            { $set: { status: 'inactive', loginDisabled: true, accessRevokedAt: new Date() } },
        );
        return { success: true, system: 'hrms', revokedAt: new Date() };
    },
});

registerAccessRevocationAdapter('manual', {
    async revoke() {
        return { success: true, system: 'manual', revokedAt: new Date(), manual: true };
    },
});

export function resolveAdapterForSystem(systemName) {
    const key = SYSTEM_ADAPTER_MAP[systemName] || 'manual';
    return adapters.get(key) || adapters.get('manual');
}

export async function revokeAccessForItem({ system, employee, organizationId, metadata = {} }) {
    const adapter = resolveAdapterForSystem(system);
    try {
        const result = await adapter.revoke({
            userEmail: employee?.email,
            employeeId: employee?._id,
            organizationId,
            metadata,
        });
        logger.info('Access revoked', { system, employeeId: employee?._id, result });
        return result;
    } catch (err) {
        logger.error('Access revocation failed', { system, error: err.message });
        return { success: false, system, error: err.message, revokedAt: null };
    }
}

export async function revokeAllMandatoryAccess(workflow, employee) {
    await assertFeatureEnabled(workflow.organizationId, 'accessRevocation', 'Access revocation');
    const results = [];
    for (const item of workflow.accessRevocation || []) {
        if (!item.mandatory || item.status === 'Completed') continue;
        const result = await revokeAccessForItem({
            system: item.system,
            employee,
            organizationId: workflow.organizationId,
        });
        if (result.success) {
            item.status = 'Completed';
            item.revokedAt = result.revokedAt;
            item.automated = !result.manual;
        }
        results.push({ system: item.system, ...result });
    }
    return results;
}

export function listAccessRevocationAdapters() {
    return [...adapters.keys()];
}
