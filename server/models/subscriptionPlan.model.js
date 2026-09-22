import mongoose from 'mongoose';
import { ALL_SAAS_FEATURES } from '../constants/saasFeatures.js';

const moduleFeatureSchema = {};
ALL_SAAS_FEATURES.forEach((key) => {
  moduleFeatureSchema[key] = { type: Boolean, default: false };
});

const subscriptionPlanSchema = new mongoose.Schema(
  {
    planId: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxEmployees: {
      type: Number,
      default: 10,
      min: 1,
    },
    trialDays: {
      type: Number,
      default: 14,
      min: 0,
    },
    features: {
      type: [String],
      default: [],
    },
    moduleFeatures: moduleFeatureSchema,
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema, 'subscription_plans');

export default SubscriptionPlan;
