import MailComposer from 'nodemailer/lib/mail-composer/index.js';
import { createEmailTransporter, detectEmailProvider, getEmailConfig } from '../config/email.config.js';
import logger from './logger.js';

const compileRawMessage = (mailOptions) => new Promise((resolve, reject) => {
  const composer = new MailComposer(mailOptions);
  composer.compile().build((err, message) => {
    if (err) {
      reject(err);
      return;
    }
    resolve(message);
  });
});

const resolveImapSettings = ({ force = false } = {}) => {
  const config = getEmailConfig();
  const provider = detectEmailProvider(config);

  if (process.env.EMAIL_IMAP_ENABLED === 'false') {
    return null;
  }

  const explicitHost = process.env.EMAIL_IMAP_HOST;
  const explicitFolder = process.env.EMAIL_IMAP_SENT_FOLDER;

  if (explicitHost) {
    return {
      host: explicitHost,
      port: parseInt(process.env.EMAIL_IMAP_PORT || '993', 10),
      secure: process.env.EMAIL_IMAP_SECURE !== 'false',
      sentFolder: explicitFolder || 'Sent',
      user: config.user,
      password: config.password
    };
  }

  if (provider.isGmail) {
    if (!force && process.env.EMAIL_SENT_IMAP_APPEND !== 'true') {
      return null;
    }
    return {
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      sentFolder: explicitFolder || '[Gmail]/Sent Mail',
      allowFolderFallback: force,
      user: config.user,
      password: config.password
    };
  }

  if (provider.isOutlook) {
    if (process.env.EMAIL_SENT_IMAP_APPEND !== 'true') {
      return null;
    }
    return {
      host: 'outlook.office365.com',
      port: 993,
      secure: true,
      sentFolder: explicitFolder || 'Sent Items',
      user: config.user,
      password: config.password
    };
  }

  if (process.env.EMAIL_IMAP_ENABLED === 'true' && config.host) {
    return {
      host: process.env.EMAIL_IMAP_HOST || config.host.replace(/^smtp\./i, 'imap.'),
      port: parseInt(process.env.EMAIL_IMAP_PORT || '993', 10),
      secure: true,
      sentFolder: explicitFolder || 'Sent',
      user: config.user,
      password: config.password
    };
  }

  return null;
};

/**
 * Append a copy of the sent message to the mailbox Sent folder (best-effort).
 * @param {Object} mailOptions - Same options passed to nodemailer sendMail
 */
export const appendMessageToSentMailbox = async (mailOptions, imapSettings = null) => {
  const settings = imapSettings || resolveImapSettings();
  if (!settings?.user || !settings?.password) {
    return;
  }

  let ImapFlow;
  try {
    const mod = await import('imapflow');
    ImapFlow = mod.ImapFlow;
  } catch {
    logger.debug('imapflow not installed; skipping Sent folder append');
    return;
  }

  let rawMessage;
  try {
    rawMessage = await compileRawMessage(mailOptions);
  } catch (error) {
    logger.warn('Failed to compile message for Sent folder append', { error: error.message });
    return;
  }

  const client = new ImapFlow({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: {
      user: settings.user,
      pass: settings.password
    },
    logger: false
  });

  const folders = [settings.sentFolder];
  if (settings.allowFolderFallback) {
    for (const name of ['[Gmail]/Sent Mail', 'Sent', 'Sent Items']) {
      if (!folders.includes(name)) folders.push(name);
    }
  }

  try {
    await client.connect();
    let savedFolder = null;
    let lastError = null;
    for (const folder of folders) {
      try {
        await client.append(folder, rawMessage, ['\\Seen']);
        savedFolder = folder;
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (lastError) {
      throw lastError;
    }
    logger.info('Appended outbound message to Sent mailbox', { folder: savedFolder });
  } catch (error) {
    logger.warn('Sent mailbox append failed (message was still sent via SMTP)', {
      folder: settings.sentFolder,
      error: error.message
    });
  } finally {
    try {
      await client.logout();
    } catch {
      // ignore logout errors
    }
  }
};

/**
 * Copy a successfully sent message into the mailbox Sent folder.
 * Failures here never affect delivery.
 * @param {Object} mailOptions
 */
export const queueSentMailboxCopy = (mailOptions, { force = false } = {}) => {
  if (!mailOptions) return;
  if (process.env.EMAIL_SENT_IMAP_APPEND === 'false') return;
  const imapSettings = resolveImapSettings({ force });
  if (!imapSettings) return;
  setImmediate(() => {
    appendMessageToSentMailbox(mailOptions, imapSettings).catch((error) => {
      logger.warn('Background Sent mailbox append failed', { error: error.message });
    });
  });
};

/**
 * Send mail and best-effort append to Sent folder for leave/regularization flows.
 * @param {import('nodemailer').Transporter} transporter
 * @param {Object} mailOptions
 * @returns {Promise<import('nodemailer').SentMessageInfo>}
 */
export const sendMailWithSentCopy = async (transporter, mailOptions) => {
  let rawMessage;
  try {
    rawMessage = await compileRawMessage(mailOptions);
  } catch (error) {
    logger.warn('Failed to compile message for send; falling back to standard sendMail', {
      error: error.message,
    });
    const info = await transporter.sendMail(mailOptions);
    queueSentMailboxCopy(mailOptions);
    return info;
  }

  const info = await transporter.sendMail({
    ...mailOptions,
    raw: rawMessage,
  });

  if (process.env.EMAIL_SENT_IMAP_APPEND !== 'false' && resolveImapSettings()) {
    queueSentMailboxCopy(mailOptions);
  }

  return info;
};

/**
 * Verify transporter (used by existing leave/regularization senders).
 */
export const verifyEmailTransporter = async (transporter) => {
  await transporter.verify();
};

export { createEmailTransporter };
