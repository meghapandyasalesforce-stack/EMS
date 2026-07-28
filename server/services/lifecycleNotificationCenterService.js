/**
 * Enterprise notification center — channel configuration per lifecycle event.
 */

import { getOrCreateLifecycleSettings } from './lifecycleConfigService.js';
import { LIFECYCLE_FEATURES } from '../constants/lifecycleFeatureRegistry.js';

export const NOTIFICATION_CHANNELS = Object.freeze([
    'email', 'sms', 'whatsapp', 'push', 'teams', 'slack', 'webhook', 'inApp',
]);

export const DEFAULT_CHANNEL_POLICY = Object.freeze({
    email: true,
    inApp: true,
    push: true,
    sms: false,
    whatsapp: false,
    teams: false,
    slack: false,
    webhook: false,
});

const LIFECYCLE_EVENT_TYPES = [
    'lifecycle_onboarding_started', 'lifecycle_onboarding_completed',
    'lifecycle_offboarding_started', 'lifecycle_offboarding_completed',
    'lifecycle_probation_review', 'lifecycle_probation_ending',
    'lifecycle_software_request', 'lifecycle_lms_enrolled',
    'lifecycle_document_expiry', 'lifecycle_report_ready',
    'lifecycle_offer_sent', 'lifecycle_bgv_update',
    'lifecycle_bulk_notification',
];

export function listLifecycleEventTypes() {
    return LIFECYCLE_EVENT_TYPES.map((type) => ({
        type,
        label: type.replace(/^lifecycle_/, '').replace(/_/g, ' '),
    }));
}

export function listNotificationChannels() {
    return NOTIFICATION_CHANNELS.map((key) => ({
        key,
        label: key.charAt(0).toUpperCase() + key.slice(1),
    }));
}

export async function getNotificationCenterConfig(organizationId) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    const global = {
        ...DEFAULT_CHANNEL_POLICY,
        ...(settings.notifications || {}),
    };
    const eventChannels = settings.notificationEventChannels || {};
    const events = LIFECYCLE_EVENT_TYPES.map((type) => ({
        type,
        channels: { ...global, ...(eventChannels[type] || {}) },
    }));
    return { global, events, webhookUrl: settings.notificationWebhookUrl || null };
}

export async function updateNotificationCenterConfig(organizationId, { global, eventChannels, webhookUrl }, { actor, req } = {}) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    if (global) settings.notifications = { ...settings.notifications, ...global };
    if (eventChannels) {
        settings.notificationEventChannels = {
            ...(settings.notificationEventChannels || {}),
            ...eventChannels,
        };
    }
    if (webhookUrl !== undefined) settings.notificationWebhookUrl = webhookUrl;
    settings.markModified('notifications');
    settings.markModified('notificationEventChannels');
    await settings.save();
    return getNotificationCenterConfig(organizationId);
}

export async function resolveChannelsForEvent(organizationId, eventType) {
    const config = await getNotificationCenterConfig(organizationId);
    const event = config.events.find((e) => e.type === eventType);
    const channels = event?.channels || config.global;
    return Object.entries(channels).filter(([, enabled]) => enabled).map(([ch]) => ch);
}

export async function dispatchToExternalChannels(organizationId, { eventType, title, message, metadata = {} }) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    const channels = await resolveChannelsForEvent(organizationId, eventType);
    const results = [];

    if (channels.includes('webhook') && settings.notificationWebhookUrl) {
        try {
            const res = await fetch(settings.notificationWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventType, title, message, metadata, organizationId }),
            });
            results.push({ channel: 'webhook', success: res.ok });
        } catch (e) {
            results.push({ channel: 'webhook', success: false, error: e.message });
        }
    }

    if (channels.includes('teams') && process.env.TEAMS_WEBHOOK_URL) {
        try {
            await fetch(process.env.TEAMS_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ '@type': 'MessageCard', summary: title, text: message }),
            });
            results.push({ channel: 'teams', success: true });
        } catch (e) {
            results.push({ channel: 'teams', success: false, error: e.message });
        }
    }

    if (channels.includes('slack') && process.env.SLACK_WEBHOOK_URL) {
        try {
            await fetch(process.env.SLACK_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: `*${title}*\n${message}` }),
            });
            results.push({ channel: 'slack', success: true });
        } catch (e) {
            results.push({ channel: 'slack', success: false, error: e.message });
        }
    }

    return results;
}
