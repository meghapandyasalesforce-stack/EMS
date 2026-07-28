import { normalizeMessageId } from './emailConversationHelper.js';

/**
 * Load stored thread root Message-ID for a record when not present on the payload.
 * @param {import('mongoose').Model} Model
 * @param {string|import('mongoose').Types.ObjectId} recordId
 * @param {string|null|undefined} fromPayload
 * @returns {Promise<string|null>}
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const resolveStoredThreadRootMessageId = async (
  Model,
  recordId,
  fromPayload,
  { retries = 0, retryDelayMs = 0 } = {}
) => {
  const maxAttempts = Math.max(1, retries + 1);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const fromData = normalizeMessageId(fromPayload);
    if (fromData) {
      return fromData;
    }
    if (!recordId || !Model) {
      return null;
    }
    const doc = await Model.findById(recordId).select('emailThreadMessageId').lean();
    const stored = normalizeMessageId(doc?.emailThreadMessageId);
    if (stored) {
      return stored;
    }
    if (attempt < maxAttempts - 1 && retryDelayMs > 0) {
      await sleep(retryDelayMs);
    }
  }

  return null;
};

/** Wait for the initial request mail to persist its Message-ID before reply mails. */
export const THREAD_ROOT_REPLY_LOOKUP = { retries: 12, retryDelayMs: 500 };

/**
 * Persist the root Message-ID after the first outbound mail in a thread.
 * @param {import('mongoose').Model} Model
 * @param {string|import('mongoose').Types.ObjectId} recordId
 * @param {string|null|undefined} threadRootMessageId
 */
export const persistThreadRootMessageId = async (Model, recordId, threadRootMessageId) => {
  const normalized = normalizeMessageId(threadRootMessageId);
  if (!Model || !recordId || !normalized) {
    return;
  }
  await Model.updateOne(
    {
      _id: recordId,
      $or: [
        { emailThreadMessageId: { $exists: false } },
        { emailThreadMessageId: null },
        { emailThreadMessageId: '' }
      ]
    },
    { $set: { emailThreadMessageId: normalized } }
  );
};
