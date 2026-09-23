import mongoose from 'mongoose';

/**
 * Idempotent store for processed Razorpay webhook events.
 * eventId = Razorpay payload `event_id` or hash of event+entity id.
 */
const billingWebhookEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      index: true,
      default: null,
    },
    payloadSummary: mongoose.Schema.Types.Mixed,
    processedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

const BillingWebhookEvent = mongoose.model(
  'BillingWebhookEvent',
  billingWebhookEventSchema,
  'billing_webhook_events'
);

export default BillingWebhookEvent;
