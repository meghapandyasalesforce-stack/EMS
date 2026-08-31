import mongoose from 'mongoose';

const ALLOWED_REACTIONS = ['❤️', '🎉', '👏', '🥳'];

const reactionSchema = new mongoose.Schema({
  emoji: {
    type: String,
    required: true,
    enum: ALLOWED_REACTIONS,
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
  },
  reactedAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: false });

const wishCommentSchema = new mongoose.Schema({
  commenterEmployeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
  },
  subjectEmployeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
  },
  comment: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: true });

const celebrationEventSchema = new mongoose.Schema({
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
  type: {
    type: String,
    enum: ['birthday', 'anniversary', 'marriage_anniversary'],
    required: true,
  },
  eventDate: {
    type: Date,
    required: true,
  },
  eventYear: {
    type: Number,
    required: true,
  },
  eventKey: {
    type: String,
    required: true,
  },
  completedYears: {
    type: Number,
    default: null,
  },
  reactions: {
    type: [reactionSchema],
    default: [],
  },
  wishes: {
    type: [wishCommentSchema],
    default: [],
  },
  eligibleViewerIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
  }],
  status: {
    type: String,
    enum: ['active', 'archived'],
    default: 'active',
  },
}, {
  timestamps: true,
});

celebrationEventSchema.index({ organizationId: 1, eventKey: 1 }, { unique: true });
celebrationEventSchema.index({ organizationId: 1, type: 1, eventDate: 1, status: 1 });
celebrationEventSchema.index({ organizationId: 1, employeeId: 1, eventYear: 1, type: 1 });

export const CELEBRATION_REACTIONS = ALLOWED_REACTIONS;
export const CelebrationEvent = mongoose.model('CelebrationEvent', celebrationEventSchema);
export default CelebrationEvent;
