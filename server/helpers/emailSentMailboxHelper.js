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

const resolveImapSettings = () => {
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
    if (process.env.EMAIL_SENT_IMAP_APPEND !== 'true') {
      return null;
    }
    return {
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      sentFolder: explicitFolder || '[Gmail]/Sent Mail',
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
export const appendMessageToSentMailbox = async (mailOptions) => {
  const imapSettings = resolveImapSettings();
  if (!imapSettings?.user || !imapSettings?.password) {
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
    host: imapSettings.host,
    port: imapSettings.port,
    secure: imapSettings.secure,
    auth: {
      user: imapSettings.user,
      pass: imapSettings.password
    },
    logger: false
  });

  try {
    await client.connect();
    await client.append(imapSettings.sentFolder, rawMessage, ['\\Seen']);
    logger.debug('Appended outbound message to Sent mailbox', {
      folder: imapSettings.sentFolder
    });
  } catch (error) {
    logger.warn('Sent mailbox append failed (message was still sent via SMTP)', {
      folder: imapSettings.sentFolder,
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
    return transporter.sendMail(mailOptions);
  }

  const info = await transporter.sendMail({
    ...mailOptions,
    raw: rawMessage,
  });

  if (process.env.EMAIL_SENT_IMAP_APPEND !== 'false' && resolveImapSettings()) {
    setImmediate(() => {
      appendMessageToSentMailbox(mailOptions).catch((error) => {
        logger.warn('Background Sent mailbox append failed', { error: error.message });
      });
    });
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
