/**
 * IMAP INBOX reader for Resume Inbox.
 * Isolated from outbound SMTP / Sent-folder helpers — does not change emailSender.
 */
import logger from './logger.js';
import { normalizeMailboxPassword } from './resumeInboxCrypto.js';

const RESUME_EXTENSIONS = new Set(['.pdf', '.doc', '.docx']);
const RESUME_MIME_HINTS = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5MB — aligned with existing upload limits

/**
 * Turn low-level IMAP errors into actionable guidance for HR users.
 */
export function formatImapError(error, imapSettings = {}) {
    const raw = String(error?.responseText || error?.authenticationFailed || error?.message || error || 'Unknown IMAP error');
    const msg = raw.replace(/\s+/g, ' ').trim().slice(0, 180);
    const lower = msg.toLowerCase();
    const provider = String(imapSettings.provider || '').toLowerCase();
    const host = String(imapSettings.host || '').toLowerCase();
    const isGmail = provider === 'gmail' || host.includes('gmail');
    const isOutlook = provider === 'outlook' || provider === 'office365'
        || host.includes('outlook') || host.includes('office365') || host.includes('hotmail');

    const authFailed = error?.authenticationFailed === true
        || lower.includes('command failed')
        || lower.includes('authentication')
        || lower.includes('invalid credentials')
        || lower.includes('auth')
        || lower.includes('login')
        || lower.includes('credentials')
        || lower.includes('invalid login');

    if (authFailed) {
        if (isGmail) {
            return `Gmail rejected login for ${imapSettings.user || 'mailbox'} @ ${imapSettings.host || 'imap.gmail.com'}. Use a Google App Password (16 characters), not your normal password. Server said: ${msg}`;
        }
        if (isOutlook) {
            return `Outlook/Office 365 rejected IMAP login for ${imapSettings.user || 'mailbox'}. Microsoft often blocks username/password IMAP — personal Outlook may need an App Password; work accounts usually need admin Basic Auth or OAuth. Prefer a Gmail mailbox for Resume Inbox. Server said: ${msg}`;
        }
        return `IMAP login failed for ${imapSettings.user || 'mailbox'} @ ${imapSettings.host || 'host'}. Check email + password/App Password. Server said: ${msg}`;
    }
    if (lower.includes('econnrefused') || lower.includes('enotfound') || lower.includes('etimedout')) {
        return `Cannot reach IMAP server (${imapSettings.host || 'host'}:${imapSettings.port || 993}). Check host, port, and network/firewall settings.`;
    }
    if (lower.includes('certificate') || lower.includes('tls') || lower.includes('ssl')) {
        return `Secure IMAP connection failed (${msg}). Use port 993 with SSL/TLS enabled.`;
    }
    return msg;
}

export function isResumeFileName(fileName = '') {
    const lower = String(fileName).toLowerCase();
    const dot = lower.lastIndexOf('.');
    if (dot < 0) return false;
    return RESUME_EXTENSIONS.has(lower.slice(dot));
}

export function isResumeAttachment({ fileName, contentType, size }) {
    if (size != null && size > MAX_ATTACHMENT_BYTES) return false;
    if (isResumeFileName(fileName)) return true;
    const mime = String(contentType || '').toLowerCase();
    return RESUME_MIME_HINTS.some((m) => mime.includes(m));
}

/**
 * Resolve IMAP connection settings from org config and/or env fallback.
 * Env keys (optional single-tenant fallback):
 *   RESUME_INBOX_ENABLED, RESUME_INBOX_HOST, RESUME_INBOX_PORT, RESUME_INBOX_USER,
 *   RESUME_INBOX_PASS, RESUME_INBOX_FOLDER, RESUME_INBOX_SECURE
 */
export function resolveResumeInboxImapSettings(orgConfig = {}, decryptedPassword = '') {
    const cfg = orgConfig || {};
    let host = String(cfg.host || '').trim();
    const provider = String(cfg.provider || '').toLowerCase();
    if (!host && provider === 'gmail') host = 'imap.gmail.com';
    if (!host && (provider === 'outlook' || provider === 'office365')) host = 'outlook.office365.com';

    if (cfg.enabled && host && cfg.user && decryptedPassword) {
        return {
            host,
            port: cfg.port || 993,
            secure: cfg.secure !== false,
            user: String(cfg.user).trim().toLowerCase(),
            password: normalizeMailboxPassword(decryptedPassword),
            folder: cfg.folder || 'INBOX',
            provider: cfg.provider || 'imap',
        };
    }

    if (process.env.RESUME_INBOX_ENABLED !== 'true') {
        return null;
    }

    const envProvider = (process.env.RESUME_INBOX_PROVIDER || '').toLowerCase();
    let envHost = process.env.RESUME_INBOX_HOST;
    if (!envHost && envProvider === 'gmail') envHost = 'imap.gmail.com';
    if (!envHost && (envProvider === 'outlook' || envProvider === 'office365')) envHost = 'outlook.office365.com';

    const user = process.env.RESUME_INBOX_USER;
    const password = process.env.RESUME_INBOX_PASS;
    if (!envHost || !user || !password) return null;

    return {
        host: envHost,
        port: parseInt(process.env.RESUME_INBOX_PORT || '993', 10),
        secure: process.env.RESUME_INBOX_SECURE !== 'false',
        user,
        password,
        folder: process.env.RESUME_INBOX_FOLDER || 'INBOX',
        provider: envProvider || 'imap',
    };
}

function parseAddressList(value) {
    if (!value) return { name: '', address: '' };
    if (typeof value === 'object' && value.address) {
        return { name: value.name || '', address: String(value.address).toLowerCase() };
    }
    const str = String(value);
    const match = str.match(/^(?:"?([^"<]*)"?\s*)?<?([^>]+@[^>]+)>?$/);
    if (match) {
        return {
            name: (match[1] || '').trim(),
            address: (match[2] || '').trim().toLowerCase(),
        };
    }
    return { name: '', address: str.toLowerCase() };
}

/**
 * Fetch recent unread messages with resume attachments from INBOX.
 * Marks processed UIDs as seen only when markSeen=true (caller decides after successful import).
 *
 * @returns {Promise<Array>} messages with attachments buffers
 */
export async function fetchUnreadResumeEmails(imapSettings, { limit = 25 } = {}) {
    const settings = {
        ...imapSettings,
        password: normalizeMailboxPassword(imapSettings?.password),
    };
    if (!settings?.host || !settings?.user || !settings?.password) {
        return [];
    }

    let ImapFlow;
    try {
        const mod = await import('imapflow');
        ImapFlow = mod.ImapFlow;
    } catch {
        logger.warn('imapflow not installed; Resume Inbox poll skipped');
        return [];
    }

    const client = new ImapFlow({
        host: settings.host,
        port: settings.port,
        secure: settings.secure,
        auth: {
            user: settings.user,
            pass: settings.password,
        },
        tls: {
            servername: settings.host,
        },
        logger: false,
    });

    const results = [];

    try {
        await client.connect();
        const folder = settings.folder || 'INBOX';
        const lock = await client.getMailboxLock(folder);
        try {
            // Unseen messages, newest first — cap with limit
            const uids = await client.search({ seen: false }, { uid: true });
            const slice = (uids || []).slice(-limit);

            for (const uid of slice) {
                try {
                    const msg = await client.fetchOne(uid, {
                        uid: true,
                        envelope: true,
                        source: false,
                        bodyStructure: true,
                        headers: ['message-id'],
                    }, { uid: true });

                    if (!msg) continue;

                    const envelope = msg.envelope || {};
                    const fromParsed = parseAddressList(envelope.from?.[0]);
                    const messageId = envelope.messageId
                        || msg.headers?.get?.('message-id')
                        || `uid-${uid}@${settings.host}`;

                    const attachments = [];
                    const parts = flattenBodyStructure(msg.bodyStructure);

                    for (const part of parts) {
                        const fileName = part.dispositionParams?.filename
                            || part.parameters?.name
                            || '';
                        const contentType = part.type && part.subtype
                            ? `${part.type}/${part.subtype}`
                            : (part.type || '');
                        const size = part.size || 0;

                        if (!isResumeAttachment({ fileName, contentType, size })) {
                            continue;
                        }
                        if (size > MAX_ATTACHMENT_BYTES) {
                            continue;
                        }

                        const download = await client.download(uid, part.part, { uid: true });
                        const chunks = [];
                        for await (const chunk of download.content) {
                            chunks.push(chunk);
                        }
                        const buffer = Buffer.concat(chunks);
                        if (buffer.length > MAX_ATTACHMENT_BYTES) continue;

                        attachments.push({
                            fileName: fileName || `resume-${uid}.pdf`,
                            contentType,
                            size: buffer.length,
                            buffer,
                        });
                    }

                    if (attachments.length === 0) {
                        // No resume — leave unread so HR can handle manually (do not mark seen)
                        continue;
                    }

                    // Fetch text body best-effort
                    let textBody = '';
                    try {
                        const textPart = parts.find((p) =>
                            String(p.type).toLowerCase() === 'text'
                            && String(p.subtype).toLowerCase() === 'plain'
                        );
                        if (textPart?.part) {
                            const dl = await client.download(uid, textPart.part, { uid: true });
                            const chunks = [];
                            for await (const chunk of dl.content) chunks.push(chunk);
                            textBody = Buffer.concat(chunks).toString('utf8').slice(0, 8000);
                        }
                    } catch {
                        // ignore body extract failures
                    }

                    results.push({
                        uid: String(uid),
                        messageId: String(messageId).trim(),
                        fromAddress: fromParsed.address,
                        fromName: fromParsed.name,
                        subject: envelope.subject || '',
                        date: envelope.date ? new Date(envelope.date) : new Date(),
                        bodyText: textBody,
                        attachments,
                    });
                } catch (msgErr) {
                    logger.warn('Resume Inbox: failed to process message', {
                        uid,
                        error: msgErr.message,
                    });
                }
            }
        } finally {
            lock.release();
        }
    } catch (error) {
        const friendly = formatImapError(error, settings);
        logger.error('Resume Inbox IMAP connect/fetch failed', {
            error: error.message,
            responseText: error.responseText,
            authenticationFailed: error.authenticationFailed,
            friendly,
            host: settings.host,
            user: settings.user,
        });
        throw Object.assign(new Error(friendly), { cause: error });
    } finally {
        try {
            await client.logout();
        } catch {
            // ignore
        }
    }

    return results;
}

/**
 * Verify IMAP credentials by connecting and reading mailbox status (no message import).
 */
export async function testImapConnection(imapSettings) {
    const settings = {
        ...imapSettings,
        password: normalizeMailboxPassword(imapSettings?.password),
    };
    if (!settings?.host || !settings?.user || !settings?.password) {
        throw Object.assign(new Error('Mailbox host, email, and password are required.'), { status: 400 });
    }

    let ImapFlow;
    try {
        const mod = await import('imapflow');
        ImapFlow = mod.ImapFlow;
    } catch {
        throw Object.assign(new Error('IMAP library (imapflow) is not installed on the server.'), { status: 500 });
    }

    const client = new ImapFlow({
        host: settings.host,
        port: settings.port,
        secure: settings.secure,
        auth: {
            user: settings.user,
            pass: settings.password,
        },
        tls: {
            servername: settings.host,
        },
        logger: false,
    });

    const folder = settings.folder || 'INBOX';

    try {
        await client.connect();
        const lock = await client.getMailboxLock(folder);
        try {
            const status = await client.status(folder, { messages: true, unseen: true });
            return {
                ok: true,
                folder,
                messages: status?.messages ?? 0,
                unseen: status?.unseen ?? 0,
            };
        } finally {
            lock.release();
        }
    } catch (error) {
        const friendly = formatImapError(error, settings);
        throw Object.assign(new Error(friendly), { cause: error, status: 400 });
    } finally {
        try {
            await client.logout();
        } catch {
            // ignore
        }
    }
}

/**
 * Mark a message as seen by UID.
 */
export async function markMessageSeen(imapSettings, uid) {
    if (!imapSettings || !uid) return;
    const settings = {
        ...imapSettings,
        password: normalizeMailboxPassword(imapSettings.password),
    };
    let ImapFlow;
    try {
        const mod = await import('imapflow');
        ImapFlow = mod.ImapFlow;
    } catch {
        return;
    }

    const client = new ImapFlow({
        host: settings.host,
        port: settings.port,
        secure: settings.secure,
        auth: { user: settings.user, pass: settings.password },
        tls: { servername: settings.host },
        logger: false,
    });

    try {
        await client.connect();
        const lock = await client.getMailboxLock(settings.folder || 'INBOX');
        try {
            await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
        } finally {
            lock.release();
        }
    } catch (error) {
        logger.warn('Resume Inbox: failed to mark seen', { uid, error: error.message });
    } finally {
        try {
            await client.logout();
        } catch {
            // ignore
        }
    }
}

function flattenBodyStructure(node, prefix = '') {
    if (!node) return [];
    const parts = [];

    if (node.childNodes?.length) {
        node.childNodes.forEach((child, idx) => {
            const childPart = child.part || (prefix ? `${prefix}.${idx + 1}` : String(idx + 1));
            parts.push(...flattenBodyStructure({ ...child, part: childPart }, childPart));
        });
        return parts;
    }

    const partId = node.part || prefix || '1';
    parts.push({
        part: partId,
        type: node.type,
        subtype: node.subtype,
        parameters: node.parameters,
        disposition: node.disposition,
        dispositionParams: node.dispositionParameters || node.dispositionParams,
        size: node.size,
    });
    return parts;
}

export { MAX_ATTACHMENT_BYTES, RESUME_EXTENSIONS };
