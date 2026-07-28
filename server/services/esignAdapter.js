/**
 * Production e-signature adapters — DocuSign, Adobe Sign, Aadhaar eSign, internal.
 * Configure via environment variables per organization (org settings override via esignProvider).
 */

import crypto from 'crypto';
import logger from '../helpers/logger.js';

const providers = new Map();

export function registerEsignProvider(name, adapter) {
    providers.set(name, adapter);
}

function buildAuditCertificate({ provider, vendorRef, signedAt, ipAddress, documentHash, signerName }) {
    return {
        certificateId: `CERT-${crypto.randomBytes(8).toString('hex').toUpperCase()}`,
        provider,
        vendorRef,
        signedAt: signedAt || new Date(),
        ipAddress,
        documentHash,
        signerName,
        algorithm: 'SHA-256',
        verified: true,
    };
}

async function httpJson(url, options = {}) {
    const res = await fetch(url, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = { raw: text }; }
    if (!res.ok) {
        const msg = body?.message || body?.error || text || res.statusText;
        throw new Error(`E-sign API error (${res.status}): ${msg}`);
    }
    return body;
}

/** Internal typed/drawn acknowledgment with audit certificate */
registerEsignProvider('internal', {
    async sign({ signatureData, ipAddress, metadata = {} }) {
        const value = typeof signatureData === 'object'
            ? (signatureData?.typedName || signatureData?.data || signatureData?.drawnData || '')
            : String(signatureData || '');
        if (!value.trim() || value.trim().length < 2) {
            throw new Error('Signature acknowledgment required');
        }
        const signedAt = new Date();
        const type = signatureData?.drawnData ? 'drawn' : (signatureData?.typedName ? 'typed' : 'acknowledgment');
        return {
            type,
            data: value.trim(),
            signedAt,
            ipAddress,
            vendorRef: null,
            certificate: buildAuditCertificate({
                provider: 'internal',
                signedAt,
                ipAddress,
                documentHash: metadata.documentHash,
                signerName: signatureData?.typedName || metadata.signerName,
            }),
            pdfVersionHistory: metadata.pdfVersionHistory || [],
            expiresAt: metadata.expiresAt || null,
        };
    },
});

/** DocuSign REST API — requires DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_ACCOUNT_ID, DOCUSIGN_ACCESS_TOKEN */
registerEsignProvider('docusign', {
    async sign({ offerLetter, signatureData, ipAddress, metadata = {} }) {
        const accountId = process.env.DOCUSIGN_ACCOUNT_ID;
        const token = process.env.DOCUSIGN_ACCESS_TOKEN;
        const baseUrl = process.env.DOCUSIGN_BASE_URL || 'https://demo.docusign.net/restapi';
        if (!accountId || !token) {
            throw new Error('DocuSign is not configured. Set DOCUSIGN_ACCOUNT_ID and DOCUSIGN_ACCESS_TOKEN.');
        }

        const envelope = await httpJson(`${baseUrl}/v2.1/accounts/${accountId}/envelopes`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: JSON.stringify({
                emailSubject: metadata.subject || 'Please sign your offer letter',
                documents: [{
                    documentId: '1',
                    name: metadata.documentName || 'Offer Letter',
                    documentBase64: metadata.documentBase64,
                }],
                recipients: {
                    signers: [{
                        email: metadata.signerEmail || offerLetter?.candidateEmail,
                        name: metadata.signerName || signatureData?.typedName,
                        recipientId: '1',
                        tabs: { signHereTabs: [{ documentId: '1', pageNumber: '1', xPosition: '100', yPosition: '200' }] },
                    }],
                },
                status: 'sent',
            }),
        });

        const signedAt = new Date();
        return {
            type: 'vendor',
            data: envelope.envelopeId,
            signedAt,
            ipAddress,
            vendorRef: envelope.envelopeId,
            provider: 'docusign',
            certificate: buildAuditCertificate({
                provider: 'docusign',
                vendorRef: envelope.envelopeId,
                signedAt,
                ipAddress,
                signerName: metadata.signerName,
            }),
            status: envelope.status,
        };
    },
    async getStatus({ vendorRef }) {
        const accountId = process.env.DOCUSIGN_ACCOUNT_ID;
        const token = process.env.DOCUSIGN_ACCESS_TOKEN;
        const baseUrl = process.env.DOCUSIGN_BASE_URL || 'https://demo.docusign.net/restapi';
        return httpJson(`${baseUrl}/v2.1/accounts/${accountId}/envelopes/${vendorRef}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
    },
});

/** Adobe Sign API */
registerEsignProvider('adobe_sign', {
    async sign({ offerLetter, signatureData, ipAddress, metadata = {} }) {
        const token = process.env.ADOBE_SIGN_ACCESS_TOKEN;
        const baseUrl = process.env.ADOBE_SIGN_BASE_URL || 'https://api.na1.adobesign.com/api/rest/v6';
        if (!token) throw new Error('Adobe Sign is not configured. Set ADOBE_SIGN_ACCESS_TOKEN.');

        const agreement = await httpJson(`${baseUrl}/agreements`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: JSON.stringify({
                fileInfos: [{ transientDocumentId: metadata.transientDocumentId }],
                name: metadata.subject || 'Offer Letter',
                participantSetsInfo: [{
                    memberInfos: [{ email: metadata.signerEmail || offerLetter?.candidateEmail }],
                    order: 1,
                    role: 'SIGNER',
                }],
                signatureType: 'ESIGN',
                state: 'IN_PROCESS',
            }),
        });

        const signedAt = new Date();
        return {
            type: 'vendor',
            data: agreement.id,
            signedAt,
            ipAddress,
            vendorRef: agreement.id,
            provider: 'adobe_sign',
            certificate: buildAuditCertificate({
                provider: 'adobe_sign',
                vendorRef: agreement.id,
                signedAt,
                ipAddress,
                signerName: metadata.signerName || signatureData?.typedName,
            }),
        };
    },
});

/** Aadhaar eSign via licensed ASP — requires AADHAAR_ESIGN_API_URL, AADHAAR_ESIGN_API_KEY */
registerEsignProvider('aadhaar_esign', {
    async sign({ signatureData, ipAddress, metadata = {} }) {
        const apiUrl = process.env.AADHAAR_ESIGN_API_URL;
        const apiKey = process.env.AADHAAR_ESIGN_API_KEY;
        if (!apiUrl || !apiKey) {
            throw new Error('Aadhaar eSign is not configured. Set AADHAAR_ESIGN_API_URL and AADHAAR_ESIGN_API_KEY.');
        }

        const result = await httpJson(`${apiUrl}/esign/initiate`, {
            method: 'POST',
            headers: { 'X-API-Key': apiKey },
            body: JSON.stringify({
                aadhaarNumber: metadata.aadhaarLast4,
                documentHash: metadata.documentHash,
                signerName: signatureData?.typedName || metadata.signerName,
                callbackUrl: metadata.callbackUrl,
            }),
        });

        const signedAt = new Date();
        return {
            type: 'vendor',
            data: result.transactionId,
            signedAt,
            ipAddress,
            vendorRef: result.transactionId,
            provider: 'aadhaar_esign',
            certificate: buildAuditCertificate({
                provider: 'aadhaar_esign',
                vendorRef: result.transactionId,
                signedAt,
                ipAddress,
                documentHash: metadata.documentHash,
                signerName: metadata.signerName,
            }),
            redirectUrl: result.redirectUrl,
        };
    },
});

export async function captureSignature({
    provider = 'internal',
    offerLetter,
    signatureData,
    ipAddress,
    metadata = {},
}) {
    const adapter = providers.get(provider) || providers.get('internal');
    if (!adapter?.sign) {
        throw new Error(`Unknown e-sign provider: ${provider}`);
    }
    const result = await adapter.sign({ offerLetter, signatureData, ipAddress, metadata });
    logger.info('E-sign captured', { provider, vendorRef: result.vendorRef, type: result.type });
    return result;
}

export async function verifySignature({ provider, vendorRef }) {
    const adapter = providers.get(provider);
    if (adapter?.getStatus) {
        return adapter.getStatus({ vendorRef });
    }
    return { status: 'unknown', provider, vendorRef };
}

/**
 * Verify inbound e-sign webhook authenticity.
 * DocuSign Connect: HMAC-SHA256 of raw body, header X-DocuSign-Signature-1
 * Adobe Sign: shared client id header X-AdobeSign-ClientId (or X-ADOBESIGN-CLIENTID)
 */
export function verifyWebhookRequest(provider, req) {
    const rawBody = Buffer.isBuffer(req.rawBody)
        ? req.rawBody
        : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}));

    if (provider === 'docusign') {
        const secret = process.env.DOCUSIGN_CONNECT_SECRET || process.env.DOCUSIGN_WEBHOOK_SECRET;
        if (!secret) {
            const err = new Error('DocuSign webhook secret is not configured (DOCUSIGN_CONNECT_SECRET)');
            err.status = 503;
            err.code = 'WEBHOOK_SECRET_MISSING';
            throw err;
        }
        const header = req.headers['x-docusign-signature-1'] || req.headers['x-docusign-signature'];
        if (!header) {
            const err = new Error('Missing DocuSign signature header');
            err.status = 401;
            err.code = 'WEBHOOK_SIGNATURE_MISSING';
            throw err;
        }
        const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
        const a = Buffer.from(String(header));
        const b = Buffer.from(expected);
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
            const err = new Error('Invalid DocuSign webhook signature');
            err.status = 401;
            err.code = 'WEBHOOK_SIGNATURE_INVALID';
            throw err;
        }
        return true;
    }

    if (provider === 'adobe_sign') {
        const expectedClientId = process.env.ADOBE_SIGN_CLIENT_ID || process.env.ADOBE_SIGN_WEBHOOK_CLIENT_ID;
        if (!expectedClientId) {
            const err = new Error('Adobe Sign webhook client id is not configured (ADOBE_SIGN_CLIENT_ID)');
            err.status = 503;
            err.code = 'WEBHOOK_SECRET_MISSING';
            throw err;
        }
        const clientId = req.headers['x-adobesign-clientid'] || req.headers['x-adobesign-client-id'];
        if (!clientId || String(clientId) !== String(expectedClientId)) {
            const err = new Error('Invalid Adobe Sign webhook client id');
            err.status = 401;
            err.code = 'WEBHOOK_SIGNATURE_INVALID';
            throw err;
        }
        return true;
    }

    const err = new Error(`Unsupported e-sign webhook provider: ${provider}`);
    err.status = 400;
    err.code = 'WEBHOOK_PROVIDER_UNKNOWN';
    throw err;
}

/** Simple in-memory replay protection for webhook event ids (best-effort per process). */
const seenWebhookEvents = new Map();
const WEBHOOK_REPLAY_TTL_MS = 15 * 60 * 1000;

export function assertWebhookNotReplay(eventKey) {
    if (!eventKey) return;
    const now = Date.now();
    for (const [k, ts] of seenWebhookEvents) {
        if (now - ts > WEBHOOK_REPLAY_TTL_MS) seenWebhookEvents.delete(k);
    }
    if (seenWebhookEvents.has(eventKey)) {
        const err = new Error('Replay detected for e-sign webhook event');
        err.status = 409;
        err.code = 'WEBHOOK_REPLAY';
        throw err;
    }
    seenWebhookEvents.set(eventKey, now);
}

export function listEsignProviders() {
    return [...providers.keys()];
}

export default { registerEsignProvider, captureSignature, verifySignature, verifyWebhookRequest, assertWebhookNotReplay, listEsignProviders };
