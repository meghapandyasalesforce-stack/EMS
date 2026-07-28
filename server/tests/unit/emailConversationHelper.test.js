import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('emailConversationHelper', () => {
  let originalEmailFrom;

  beforeEach(async () => {
    const config = await import('../../config/email.config.js');
    originalEmailFrom = process.env.EMAIL_FROM;
    process.env.EMAIL_FROM = 'hr@paarsiv.com';
  });

  afterEach(() => {
    if (originalEmailFrom === undefined) {
      delete process.env.EMAIL_FROM;
    } else {
      process.env.EMAIL_FROM = originalEmailFrom;
    }
  });

  it('normalizes Message-ID values', async () => {
    const { normalizeMessageId } = await import('../../helpers/emailConversationHelper.js');
    expect(normalizeMessageId('abc@domain.com')).toBe('<abc@domain.com>');
    expect(normalizeMessageId('<abc@domain.com>')).toBe('<abc@domain.com>');
    expect(normalizeMessageId('')).toBeNull();
  });

  it('creates distinct thread roots for leave vs regularization', async () => {
    const {
      buildConversationMailOptions,
      LEAVE_EMAIL_THREAD_MODULE,
      REGULARIZATION_EMAIL_THREAD_MODULE
    } = await import('../../helpers/emailConversationHelper.js');

    const recordId = '507f1f77bcf86cd799439011';
    const leaveOpts = buildConversationMailOptions({
      module: LEAVE_EMAIL_THREAD_MODULE,
      recordId,
      threadRootMessageId: null,
      threadRole: 'initial',
    });
    const regOpts = buildConversationMailOptions({
      module: REGULARIZATION_EMAIL_THREAD_MODULE,
      recordId,
      threadRootMessageId: null,
      threadRole: 'initial',
    });

    expect(leaveOpts.messageId).toContain('leave.');
    expect(regOpts.messageId).toContain('attendance-regularization.');
    expect(leaveOpts.messageId).not.toBe(regOpts.messageId);
  });

  it('adds In-Reply-To and References for follow-up mails', async () => {
    const { buildConversationMailOptions, LEAVE_EMAIL_THREAD_MODULE } = await import('../../helpers/emailConversationHelper.js');
    const root = '<leave.507f1f77bcf86cd799439011@paarsiv.com>';
    const opts = buildConversationMailOptions({
      module: LEAVE_EMAIL_THREAD_MODULE,
      recordId: '507f1f77bcf86cd799439011',
      threadRootMessageId: root,
      threadRole: 'reply',
    });

    expect(opts.headers['In-Reply-To']).toBe(root);
    expect(opts.headers.References).toBe(root);
    expect(opts.messageId).toBeUndefined();
  });

  it('uses reply headers for approval path even when thread root is not yet stored', async () => {
    const { buildConversationMailOptions, REGULARIZATION_EMAIL_THREAD_MODULE } = await import('../../helpers/emailConversationHelper.js');
    const opts = buildConversationMailOptions({
      module: REGULARIZATION_EMAIL_THREAD_MODULE,
      recordId: '507f1f77bcf86cd799439011',
      threadRootMessageId: null,
      threadRole: 'reply',
    });
    expect(opts.headers['In-Reply-To']).toContain('attendance-regularization.');
    expect(opts.messageId).toBeUndefined();
  });

  it('resolves thread root after send', async () => {
    const { resolveThreadRootAfterSend } = await import('../../helpers/emailConversationHelper.js');
    const preset = { messageId: '<leave.abc@paarsiv.com>' };
    expect(resolveThreadRootAfterSend(null, preset, '<smtp-assigned@x.com>', 'initial')).toBe('<smtp-assigned@x.com>');
    expect(resolveThreadRootAfterSend('<existing@x.com>', {}, '<other@x.com>', 'initial')).toBe('<existing@x.com>');
  });
});
