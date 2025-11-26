import mongoose from 'mongoose';

const pushSubscriptionSchema = new mongoose.Schema({
  // Organization reference (multi-tenancy)
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'userType',
    required: true
  },
  userType: {
    type: String,
    enum: ['User', 'Employee'],
    default: 'User'
  },
  endpoint: { 
    type: String, 
    required: true,
    unique: true
  },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true }
  },
  userAgent: String,
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
}, { timestamps: true });

// Index for efficient queries
pushSubscriptionSchema.index({ userId: 1, userType: 1 });
// Note: endpoint already has an index from unique: true, so no need to create duplicate

const PushSubscription = mongoose.model('PushSubscription', pushSubscriptionSchema);

export default PushSubscription;

