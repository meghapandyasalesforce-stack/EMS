import mongoose from "mongoose";
import logger from "../helpers/logger.js";

const organizationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Organization name is required'],
        trim: true,
        minlength: [2, 'Organization name must be at least 2 characters long']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'],
        index: true
    },
    phone: {
        type: String,
        trim: true,
        match: [/^\+?[\d\s-()]+$/, 'Please enter a valid phone number']
    },
    address: {
        street: { type: String, trim: true },
        city: { type: String, trim: true },
        state: { type: String, trim: true },
        country: { type: String, trim: true },
        zipCode: { type: String, trim: true }
    },
    domain: {
        type: String,
        unique: true,
        sparse: true, // Allow null values but enforce uniqueness when present
        trim: true,
        lowercase: true,
        index: true
    },
    subscriptionPlan: {
        type: String,
        enum: ['free', 'basic', 'premium', 'enterprise'],
        default: 'free'
    },
    maxEmployees: {
        type: Number,
        default: 10,
        min: 1
    },
    isActive: {
        type: Boolean,
        default: true
    },
    // Email verification
    emailVerified: {
        type: Boolean,
        default: false
    },
    emailVerificationToken: {
        type: String,
        sparse: true
    },
    emailVerificationExpires: {
        type: Date
    },
    // Industry and company details
    industry: {
        type: String,
        trim: true,
        enum: ['IT', 'Healthcare', 'Finance', 'Manufacturing', 'Retail', 'Education', 'Real Estate', 'Hospitality', 'Construction', 'Transportation', 'Other']
    },
    companySize: {
        type: String,
        enum: ['startup', 'small', 'medium', 'large', 'enterprise'],
        default: 'small'
    },
    estimatedEmployees: {
        type: Number,
        min: 1
    },
    businessType: {
        type: String,
        enum: ['private', 'public', 'non-profit', 'government']
    },
    // Configuration settings
    timezone: {
        type: String,
        default: 'UTC'
    },
    currency: {
        type: String,
        default: 'USD',
        uppercase: true,
        length: 3
    },
    dateFormat: {
        type: String,
        enum: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'],
        default: 'MM/DD/YYYY'
    },
    language: {
        type: String,
        default: 'en',
        length: 2
    },
    workingDays: {
        type: [Number], // 0-6 (Sunday-Saturday)
        default: [1, 2, 3, 4, 5] // Monday-Friday
    },
    workingHours: {
        start: { type: String, default: '09:00' },
        end: { type: String, default: '17:00' }
    },
    // Trial period
    trialStartDate: {
        type: Date
    },
    trialEndDate: {
        type: Date
    },
    trialDays: {
        type: Number,
        default: 14
    },
    isTrialActive: {
        type: Boolean,
        default: false
    },
    // Payment and billing
    paymentMethod: {
        type: String,
        enum: ['none', 'stripe', 'paypal', 'bank_transfer']
    },
    stripeCustomerId: {
        type: String,
        sparse: true
    },
    stripeSubscriptionId: {
        type: String,
        sparse: true
    },
    subscriptionStatus: {
        type: String,
        enum: ['active', 'trial', 'expired', 'cancelled', 'past_due'],
        default: 'trial'
    },
    subscriptionStartDate: {
        type: Date
    },
    subscriptionEndDate: {
        type: Date
    },
    // Organization verification
    verificationStatus: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending'
    },
    businessRegistrationNumber: {
        type: String,
        trim: true
    },
    taxId: {
        type: String,
        trim: true
    },
    verificationDocuments: [{
        type: { type: String },
        url: { type: String },
        filename: { type: String },
        uploadedAt: { type: Date }
    }],
    verifiedAt: {
        type: Date
    },
    // Referral system
    referralCode: {
        type: String,
        unique: true,
        sparse: true,
        uppercase: true
    },
    referredBy: {
        organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
        referralCode: { type: String }
    },
    // Analytics
    registrationSource: {
        type: String,
        enum: ['direct', 'referral', 'google_ads', 'facebook_ads', 'linkedin', 'other']
    },
    registrationMetadata: {
        ipAddress: { type: String },
        userAgent: { type: String },
        campaignId: { type: String },
        utmSource: { type: String },
        utmMedium: { type: String },
        utmCampaign: { type: String }
    },
    // Compliance
    gdprConsent: {
        type: Boolean,
        default: false
    },
    gdprConsentDate: {
        type: Date
    },
    termsAccepted: {
        type: Boolean,
        default: false
    },
    termsAcceptedDate: {
        type: Date
    },
    privacyPolicyAccepted: {
        type: Boolean,
        default: false
    },
    privacyPolicyAcceptedDate: {
        type: Date
    },
    dataProcessingAgreement: {
        accepted: { type: Boolean, default: false },
        acceptedDate: { type: Date }
    },
    settings: {
        allowEmployeeRegistration: { 
            type: Boolean, 
            default: true 
        },
        requireEmailVerification: { 
            type: Boolean, 
            default: true // Changed default to true for better security
        },
        allowSelfService: {
            type: Boolean,
            default: true
        },
        employeeIdPrefix: {
            type: String,
            trim: true,
            uppercase: true,
            default: null
        },
        employeeIdNextNumber: {
            type: Number,
            default: null,
            min: 1
        },
        employeeIdMinDigits: {
            type: Number,
            default: 3,
            min: 2,
            max: 10
        },
        twoFactorAuth: {
            enabled: { type: Boolean, default: false },
            required: { type: Boolean, default: false }
        },
        ssoEnabled: {
            type: Boolean,
            default: false
        },
        ipWhitelist: {
            enabled: { type: Boolean, default: false },
            addresses: [{ type: String }]
        }
    },
    logo: {
        url: { type: String },
        filename: { type: String },
        uploadedAt: { type: Date }
    },
    // Branding
    branding: {
        primaryColor: { type: String, default: '#16a34a' },
        secondaryColor: { type: String, default: '#2563eb' },
        accentColor: { type: String, default: '#f97316' },
        backgroundColor: { type: String },
        textColor: { type: String },
        theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'light' },
        customDomain: { type: String }
    },
    // Saved theme presets so admin can switch back to a previous theme
    themePresets: [{
        name: { type: String, required: true },
        primaryColor: { type: String },
        secondaryColor: { type: String },
        accentColor: { type: String },
        backgroundColor: { type: String },
        textColor: { type: String }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Add database indexes for better query performance
// Note: email and domain indexes are already created by unique: true, so we don't duplicate them
organizationSchema.index({ isActive: 1 });
organizationSchema.index({ subscriptionPlan: 1 });
organizationSchema.index({ createdAt: -1 }); // For sorting by creation date

// Add toJSON method to remove sensitive data if needed
organizationSchema.methods.toJSON = function() {
    const obj = this.toObject();
    // Can remove sensitive fields here if needed
    return obj;
};

const Organization = mongoose.model("Organization", organizationSchema, "organizations");

export default Organization;

