import mongoose from 'mongoose';

/**
 * Billing payment / invoice ledger for SaaS subscriptions.
 * One row per successful (or failed) charge attempt.
 */
const billingPaymentSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    planId: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'succeeded', 'failed', 'refunded'],
      default: 'pending',
      index: true,
    },
    source: {
      type: String,
      enum: ['checkout', 'webhook', 'mock', 'manual'],
      default: 'checkout',
    },
    amountMinor: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
    },
    /** Human-readable invoice number e.g. INV-2026-00042 */
    invoiceNumber: {
      type: String,
      sparse: true,
      unique: true,
    },
    razorpayPaymentId: {
      type: String,
      sparse: true,
      unique: true,
    },
    razorpayOrderId: {
      type: String,
      sparse: true,
      index: true,
    },
    razorpaySubscriptionId: {
      type: String,
      sparse: true,
      index: true,
    },
    razorpayInvoiceId: {
      type: String,
      sparse: true,
    },
    periodStart: Date,
    periodEnd: Date,
    failureReason: String,
    metadata: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

billingPaymentSchema.index({ organizationId: 1, createdAt: -1 });

const BillingPayment = mongoose.model('BillingPayment', billingPaymentSchema, 'billing_payments');

export default BillingPayment;
