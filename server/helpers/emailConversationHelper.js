import { getEmailFrom, getEmailConfig } from '../config/email.config.js';
export const LEAVE_EMAIL_THREAD_MODULE = 'leave';
export const REGULARIZATION_EMAIL_THREAD_MODULE = 'regularization';

/** @deprecated Use LEAVE_EMAIL_THREAD_MODULE */
export const EMAIL_THREAD_MODULES = {
    LEAVE: LEAVE_EMAIL_THREAD_MODULE,
    REGULARIZATION: REGULARIZATION_EMAIL_THREAD_MODULE,
};

const MODULE_MESSAGE_ID_PREFIX = {
    [LEAVE_EMAIL_THREAD_MODULE]: 'leave',
    [REGULARIZATION_EMAIL_THREAD_MODULE]: 'attendance-regularization',
};

/**
 * Normalize a Message-ID to angle-bracket form.
 * @param {string|null|undefined} messageId
 * @returns {string|null}
 */
export const normalizeMessageId = (messageId) => {
    if (!messageId || typeof messageId !== 'string') {
        return null;
    }
    const trimmed = messageId.trim();
    if (!trimmed) {
        return null;
    }
    if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
        return trimmed;
    }
    return `<${trimmed.replace(/^<|>$/g, '')}>`;
};

/**
 * Derive the domain used in generated Message-IDs from EMAIL_FROM / EMAIL_USER.
 * @returns {string}
 */
export const getMessageIdDomain = () => {
    const from = getEmailFrom() || getEmailConfig().user || 'localhost';
    const emailMatch = String(from).match(/<([^>]+)>/);
    const email = emailMatch ? emailMatch[1] : from;
    const domain = String(email).split('@')[1];
    return domain || 'localhost';
};

/**
 * Build a new root Message-ID for the first email in a business-process thread.
 * @param {string} module
 * @param {string} recordId
 * @returns {string}
 */
export const generateThreadRootMessageId = (module, recordId) => {
    const prefix = MODULE_MESSAGE_ID_PREFIX[module] || 'ems';
    const id = String(recordId || 'unknown');
    return `<${prefix}.${id}@${getMessageIdDomain()}>`;
};

/**
 * @typedef {'initial' | 'reply'} EmailThreadRole
 */

/**
 * Build nodemailer options for conversation threading (Message-ID or In-Reply-To / References).
 * Reply mails must always use In-Reply-To; never assign the thread root as a new Message-ID.
 * @param {{ module: string, recordId: string, threadRootMessageId?: string|null, threadRole?: EmailThreadRole }} params
 * @returns {{ messageId?: string, headers?: Record<string, string> }}
 */
export const buildConversationMailOptions = ({
    module,
    recordId,
    threadRootMessageId,
    threadRole = 'initial',
}) => {
    const root =
        normalizeMessageId(threadRootMessageId) ||
        (recordId ? generateThreadRootMessageId(module, recordId) : null);

    if (threadRole === 'reply') {
        if (!root) {
            return {};
        }
        return {
            headers: {
                'In-Reply-To': root,
                References: root,
            },
        };
    }

    if (!root) {
        return {};
    }

    return {
        messageId: root,
    };
};

/**
 * @param {string|null|undefined} existingRoot
 * @param {{ messageId?: string }} conversationOptions
 * @param {string|null|undefined} sentMessageId
 * @returns {string|null}
 */
export const resolveThreadRootAfterSend = (existingRoot, conversationOptions, sentMessageId, threadRole = 'initial') => {
    const fromExisting = normalizeMessageId(existingRoot);
    if (fromExisting) {
        return fromExisting;
    }
    if (threadRole === 'initial') {
        return (
            normalizeMessageId(sentMessageId) ||
            normalizeMessageId(conversationOptions?.messageId)
        );
    }
    return normalizeMessageId(conversationOptions?.headers?.['In-Reply-To']);
};

/**
 * Apply threading headers for leave / regularization conversation emails (legacy helper).
 * @param {Object} mailOptions
 * @param {string} module
 * @param {string} recordId
 * @param {string|null|undefined} existingRootMessageId
 * @returns {{ rootMessageId: string|null, isNewThread: boolean }}
 */
export const applyConversationThreadHeaders = (mailOptions, module, recordId, existingRootMessageId) => {
    const conversationOptions = buildConversationMailOptions({
        module,
        recordId,
        threadRootMessageId: existingRootMessageId,
        threadRole: existingRootMessageId ? 'reply' : 'initial',
    });

    if (conversationOptions.messageId) {
        mailOptions.messageId = conversationOptions.messageId;
        return { rootMessageId: conversationOptions.messageId, isNewThread: true };
    }

    mailOptions.headers = {
        ...(mailOptions.headers || {}),
        ...conversationOptions.headers,
    };
    const root = normalizeMessageId(conversationOptions.headers?.['In-Reply-To']);
    return { rootMessageId: root, isNewThread: false };
};
