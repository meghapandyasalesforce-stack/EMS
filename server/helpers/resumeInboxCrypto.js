import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;

function getKey() {
    const secret = process.env.RESUME_INBOX_ENCRYPTION_KEY
        || process.env.ENCRYPTION_KEY
        || process.env.JWT_SECRET
        || 'ems-resume-inbox-dev-key';
    return crypto.createHash('sha256').update(String(secret)).digest();
}

/** Gmail app passwords are 16 chars; Google displays them with spaces — strip for IMAP auth. */
export function normalizeMailboxPassword(password) {
    return String(password || '').trim().replace(/\s+/g, '');
}

/**
 * Encrypt mailbox password for storage. Returns base64 "iv:tag:ciphertext".
 */
export function encryptSecret(plainText) {
    if (!plainText) return '';
    const normalized = normalizeMailboxPassword(plainText);
    if (!normalized) return '';
    const iv = crypto.randomBytes(IV_LEN);
    const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(normalized, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Decrypt mailbox password. Returns empty string on failure.
 */
export function decryptSecret(payload) {
    if (!payload || typeof payload !== 'string') return '';
    try {
        const [ivB64, tagB64, dataB64] = payload.split(':');
        if (!ivB64 || !tagB64 || !dataB64) return '';
        const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, 'base64'));
        decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
        const decrypted = Buffer.concat([
            decipher.update(Buffer.from(dataB64, 'base64')),
            decipher.final(),
        ]);
        return decrypted.toString('utf8');
    } catch {
        return '';
    }
}
