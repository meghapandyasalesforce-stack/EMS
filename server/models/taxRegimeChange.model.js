import mongoose from 'mongoose';

const taxRegimeChangeSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    currentTaxRegime: {
      type: String,
      default: 'New',
    },
    requestedTaxRegime: {
      type: String,
      required: true,
      enum: ['N/A'],
      default: 'N/A',
    },
    reason: {
      type: String,
      maxlength: 500,
      default: 'Employee requested N/A (no TDS) tax regime',
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
    },
    reviewedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      maxlength: 500,
    },
    approvalInstanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ApprovalInstance',
    },
  },
  { timestamps: true }
);

taxRegimeChangeSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
taxRegimeChangeSchema.index({ employeeId: 1, status: 1 });

const TaxRegimeChange = mongoose.model('TaxRegimeChange', taxRegimeChangeSchema);

export default TaxRegimeChange;
