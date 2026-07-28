/**
 * E-sign vendor webhooks — DocuSign, Adobe Sign status callbacks.
 * Requires verified HMAC / client-id; rejects unsigned and replayed events.
 */

import { OfferLetter } from '../../models/lifecycleGap.model.js';
import { logLifecycleAudit } from '../../services/lifecycleAuditService.js';
import { verifySignature, verifyWebhookRequest, assertWebhookNotReplay } from '../../services/esignAdapter.js';
import { isOrgFeatureEnabled } from '../../services/lifecycleConfigService.js';
import { notify } from '../../helpers/notificationManager.js';
import logger from '../../helpers/logger.js';

export async function handleDocuSignWebhook(payload) {
    const envelopeId = payload?.envelopeId || payload?.data?.envelopeId;
    const status = payload?.status || payload?.data?.envelopeSummary?.status;
    const eventId = payload?.eventId || payload?.id || `${envelopeId}:${status}`;
    if (!envelopeId) return { handled: false, reason: 'missing envelopeId' };

    assertWebhookNotReplay(`docusign:${eventId}`);

    const offer = await OfferLetter.findOne({ 'signature.vendorRef': envelopeId });
    if (!offer) return { handled: false, reason: 'offer not found' };

    if (!(await isOrgFeatureEnabled(offer.organizationId, 'eSignature'))) {
        logger.info('Ignoring DocuSign webhook — eSignature disabled in Configure', {
            organizationId: String(offer.organizationId),
            envelopeId,
        });
        return { handled: false, reason: 'FEATURE_DISABLED', featureKey: 'eSignature' };
    }

    if (status === 'completed' || status === 'Completed') {
        offer.status = 'Accepted';
        offer.respondedAt = new Date();
        offer.signature = {
            ...(offer.signature?.toObject?.() || offer.signature || {}),
            type: 'vendor',
            signedAt: new Date(),
            vendorRef: envelopeId,
            provider: 'docusign',
        };
        offer.activityFeed = offer.activityFeed || [];
        offer.activityFeed.unshift({
            action: 'esign_completed',
            description: 'DocuSign envelope completed',
            createdAt: new Date(),
        });
        await offer.save();
        await logLifecycleAudit({
            action: 'Update',
            entityType: 'Offer',
            entityId: offer._id,
            entityName: 'DocuSign Webhook',
            metadata: { envelopeId, status, provider: 'docusign' },
        });
        await notify({
            type: 'lifecycle_offer_accepted',
            organizationId: offer.organizationId,
            data: { offerId: offer._id, envelopeId, provider: 'docusign' },
        }).catch(() => {});
    }
    return { handled: true, offerId: offer._id, status };
}

export async function handleAdobeSignWebhook(payload) {
    const agreementId = payload?.agreement?.id || payload?.agreementId;
    const event = payload?.event || payload?.eventType;
    const eventId = payload?.eventId || payload?.id || `${agreementId}:${event}`;
    if (!agreementId) return { handled: false, reason: 'missing agreementId' };

    assertWebhookNotReplay(`adobe_sign:${eventId}`);

    const offer = await OfferLetter.findOne({ 'signature.vendorRef': agreementId });
    if (!offer) return { handled: false, reason: 'offer not found' };

    if (!(await isOrgFeatureEnabled(offer.organizationId, 'eSignature'))) {
        return { handled: false, reason: 'FEATURE_DISABLED', featureKey: 'eSignature' };
    }

    if (event === 'AGREEMENT_WORKFLOW_COMPLETED' || payload?.agreement?.status === 'SIGNED') {
        offer.status = 'Accepted';
        offer.respondedAt = new Date();
        offer.signature = {
            ...(offer.signature?.toObject?.() || offer.signature || {}),
            type: 'vendor',
            signedAt: new Date(),
            vendorRef: agreementId,
            provider: 'adobe_sign',
        };
        offer.activityFeed = offer.activityFeed || [];
        offer.activityFeed.unshift({
            action: 'esign_completed',
            description: 'Adobe Sign agreement completed',
            createdAt: new Date(),
        });
        await offer.save();
        await logLifecycleAudit({
            action: 'Update',
            entityType: 'Offer',
            entityId: offer._id,
            entityName: 'Adobe Sign Webhook',
            metadata: { agreementId, event, provider: 'adobe_sign' },
        });
        await notify({
            type: 'lifecycle_offer_accepted',
            organizationId: offer.organizationId,
            data: { offerId: offer._id, agreementId, provider: 'adobe_sign' },
        }).catch(() => {});
    }
    return { handled: true, offerId: offer._id };
}

export async function handleEsignWebhook(provider, req) {
    verifyWebhookRequest(provider, req);
    logger.info('E-sign webhook verified', { provider });
    switch (provider) {
        case 'docusign':
            return handleDocuSignWebhook(req.body);
        case 'adobe_sign':
            return handleAdobeSignWebhook(req.body);
        default: {
            const err = new Error(`Unknown e-sign provider: ${provider}`);
            err.status = 400;
            throw err;
        }
    }
}

export async function verifyEsignStatus(offerLetter) {
    if (!offerLetter?.esignProvider || !offerLetter?.signature?.vendorRef) return null;
    return verifySignature({
        provider: offerLetter.esignProvider,
        vendorRef: offerLetter.signature.vendorRef,
    });
}
