/**
 * IT ticketing adapters — ServiceNow, Jira Service Management, Freshservice, Zendesk.
 */

import logger from '../helpers/logger.js';

const providers = new Map();

export function registerItTicketingProvider(name, adapter) {
    providers.set(name, adapter);
}

async function httpJson(url, options = {}) {
    const res = await fetch(url, options);
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = { raw: text }; }
    if (!res.ok) throw new Error(body.error?.message || body.message || res.statusText);
    return body;
}

function manualRequiredTicket(provider, payload) {
    return {
        success: false,
        stub: false,
        manualRequired: true,
        ticketId: null,
        ticketUrl: null,
        provider,
        summary: payload.summary,
        message: 'Manual Processing Required — ticketing credentials are not configured',
    };
}

registerItTicketingProvider('servicenow', {
    async createTicket({ summary, description, priority = '3', category = 'software' }) {
        const base = process.env.SERVICENOW_URL;
        const user = process.env.SERVICENOW_USER;
        const pass = process.env.SERVICENOW_PASSWORD;
        if (!base || !user || !pass) return manualRequiredTicket('servicenow', { summary });

        const auth = Buffer.from(`${user}:${pass}`).toString('base64');
        const body = await httpJson(`${base}/api/now/table/incident`, {
            method: 'POST',
            headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ short_description: summary, description, urgency: priority, category }),
        });
        const rec = body.result;
        return {
            success: true,
            ticketId: rec?.number || rec?.sys_id,
            ticketUrl: `${base}/nav_to.do?uri=incident.do?sys_id=${rec?.sys_id}`,
            provider: 'servicenow',
        };
    },
});

registerItTicketingProvider('jira', {
    async createTicket({ summary, description, projectKey }) {
        const base = process.env.JIRA_URL;
        const email = process.env.JIRA_EMAIL;
        const token = process.env.JIRA_API_TOKEN;
        const project = projectKey || process.env.JIRA_SERVICE_DESK_PROJECT;
        if (!base || !email || !token || !project) return manualRequiredTicket('jira', { summary });

        const auth = Buffer.from(`${email}:${token}`).toString('base64');
        const body = await httpJson(`${base}/rest/api/3/issue`, {
            method: 'POST',
            headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fields: {
                    project: { key: project },
                    summary,
                    description: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: description || summary }] }] },
                    issuetype: { name: 'Service Request' },
                },
            }),
        });
        return {
            success: true,
            ticketId: body.key,
            ticketUrl: `${base}/browse/${body.key}`,
            provider: 'jira',
        };
    },
});

registerItTicketingProvider('freshservice', {
    async createTicket({ summary, description, priority = 2 }) {
        const base = process.env.FRESHSERVICE_URL;
        const apiKey = process.env.FRESHSERVICE_API_KEY;
        if (!base || !apiKey) return manualRequiredTicket('freshservice', { summary });

        const body = await httpJson(`${base}/api/v2/tickets`, {
            method: 'POST',
            headers: { Authorization: `Basic ${Buffer.from(`${apiKey}:X`).toString('base64')}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject: summary, description: description || summary, priority, status: 2 }),
        });
        const ticket = body.ticket;
        return {
            success: true,
            ticketId: String(ticket?.id),
            ticketUrl: `${base}/helpdesk/tickets/${ticket?.id}`,
            provider: 'freshservice',
        };
    },
});

registerItTicketingProvider('zendesk', {
    async createTicket({ summary, description, requesterEmail }) {
        const subdomain = process.env.ZENDESK_SUBDOMAIN;
        const token = process.env.ZENDESK_API_TOKEN;
        const email = process.env.ZENDESK_EMAIL;
        if (!subdomain || !token || !email) return manualRequiredTicket('zendesk', { summary });

        const body = await httpJson(`https://${subdomain}.zendesk.com/api/v2/tickets.json`, {
            method: 'POST',
            headers: {
                Authorization: `Basic ${Buffer.from(`${email}/token:${token}`).toString('base64')}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ticket: { subject: summary, comment: { body: description || summary }, requester: { email: requesterEmail } },
            }),
        });
        const ticket = body.ticket;
        return {
            success: true,
            ticketId: String(ticket?.id),
            ticketUrl: `https://${subdomain}.zendesk.com/agent/tickets/${ticket?.id}`,
            provider: 'zendesk',
        };
    },
});

registerItTicketingProvider('manual', {
    async createTicket({ summary }) {
        return {
            success: false,
            manualRequired: true,
            ticketId: null,
            ticketUrl: null,
            provider: 'manual',
            manual: true,
            summary,
            message: 'Manual Processing Required — assign IT and mark provisioned when complete',
        };
    },
});

export function listItTicketingProviders() {
    return [...providers.keys()].map((key) => ({
        key,
        label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        configured: key === 'manual' || Boolean(getProviderEnvStatus(key)),
    }));
}

function getProviderEnvStatus(key) {
    const map = {
        servicenow: () => process.env.SERVICENOW_URL && process.env.SERVICENOW_USER,
        jira: () => process.env.JIRA_URL && process.env.JIRA_API_TOKEN,
        freshservice: () => process.env.FRESHSERVICE_URL && process.env.FRESHSERVICE_API_KEY,
        zendesk: () => process.env.ZENDESK_SUBDOMAIN && process.env.ZENDESK_API_TOKEN,
    };
    return map[key]?.();
}

export async function createItTicket(provider = 'manual', payload = {}) {
    const adapter = providers.get(provider) || providers.get('manual');
    try {
        return await adapter.createTicket(payload);
    } catch (error) {
        logger.warn(`IT ticket creation failed (${provider}): ${error.message}`);
        return { success: false, provider, error: error.message };
    }
}
