import mongoose from "mongoose";
import logger from "../helpers/logger.js";

const organizationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Organization name is required'],
        trim: true,
        minlength: [2, 'Organization name must be at least 2 characters long']
    },
    legalName: {
        type: String,
        trim: true
    },
    website: {
        type: String,
        trim: true
    },
    gstNumber: {
        type: String,
        trim: true
    },
    panNumber: {
        type: String,
        trim: true
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
    /** Set true when enterprise lifecycle is bootstrapped at org registration */
    lifecycleEnterpriseEnabled: {
        type: Boolean,
        default: false,
        index: true,
    },
    lifecycleEnterpriseBootstrappedAt: {
        type: Date,
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
    timeFormat: {
        type: String,
        enum: ['12h', '24h'],
        default: '24h'
    },
    financialYearStart: {
        type: Number,
        min: 1,
        max: 12,
        default: 4
    },
    breakPolicy: {
        durationMinutes: { type: Number, default: 60 },
        paidBreak: { type: Boolean, default: true }
    },
    officeLocations: [{
        name: { type: String, trim: true },
        type: { type: String, enum: ['head', 'branch'], default: 'branch' },
        isPrimary: { type: Boolean, default: false },
        address: {
            street: { type: String, trim: true },
            city: { type: String, trim: true },
            state: { type: String, trim: true },
            country: { type: String, trim: true },
            zipCode: { type: String, trim: true }
        },
        phone: { type: String, trim: true }
    }],
    orgDepartments: [{
        name: { type: String, trim: true, required: true },
        code: { type: String, trim: true },
        description: { type: String, trim: true }
    }],
    orgDesignations: [{
        title: { type: String, trim: true, required: true },
        department: { type: String, trim: true },
        level: { type: String, trim: true }
    }],
    employmentTypes: [{
        name: { type: String, trim: true },
        code: { type: String, trim: true },
        description: { type: String, trim: true }
    }],
    shiftTypes: [{
        name: { type: String, trim: true },
        startTime: { type: String },
        endTime: { type: String },
        description: { type: String, trim: true }
    }],
    emailBranding: {
        headerColor: { type: String },
        footerText: { type: String },
        logoUrl: { type: String }
    },
    banner: {
        url: { type: String },
        filename: { type: String },
        uploadedAt: { type: Date }
    },
    setupOnboarding: {
        status: {
            type: String,
            enum: ['not_started', 'in_progress', 'completed'],
            default: 'not_started'
        },
        currentStep: { type: String, default: 'welcome' },
        completedSteps: [{ type: String }],
        skippedSteps: [{ type: String }],
        completedAt: { type: Date },
        invitedUsers: [{
            email: String,
            role: String,
            invitedAt: Date,
            status: { type: String, enum: ['pending', 'accepted'], default: 'pending' }
        }]
    },
    /** Employee onboarding org-level settings */
    onboardingSettings: {
        autoCreateOnEmployeeRegister: { type: Boolean, default: false },
        startWorkflowOnJoiningDate: { type: Boolean, default: true },
        defaultTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'OnboardingTemplate' },
    },
    /** Org wizard — policy docs, SMTP, integrations (optional setup) */
    orgSetupExtras: {
        subscriptionPlan: { type: String, default: 'trial' },
        companyPoliciesUrl: String,
        smtpConfigured: { type: Boolean, default: false },
        notificationPreferences: {
            emailOnboarding: { type: Boolean, default: true },
            emailDocuments: { type: Boolean, default: true },
            emailReminders: { type: Boolean, default: true },
        },
        integrations: {
            google: { type: Boolean, default: false },
            microsoft: { type: Boolean, default: false },
            slack: { type: Boolean, default: false },
        },
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
        },
        /**
         * Payroll TDS monthly cut mode (org-scoped, SaaS-ready).
         * - cumulative: tax due through FY month N minus YTD TDS (catch-up)
         * - independent: this month's share only; no past TDS adjustment
         */
        tdsCalculationMode: {
            type: String,
            enum: ['cumulative', 'independent'],
            default: 'cumulative'
        },
        /**
         * Work From Home: when true, employees can punch in with the
         * "Work From Home" option (office geofence not enforced for WFH punches).
         * Defaults to true to preserve existing punch-in behavior.
         */
        allowWorkFromHome: {
            type: Boolean,
            default: true
        },
        /**
         * Non-working day punch: when true, employees may punch in on
         * calendar non-working days (weekends / off days) and holidays.
         * Defaults to false — punch-in is blocked unless admin enables this.
         */
        allowNonWorkingDayPunch: {
            type: Boolean,
            default: false
        },
        approvalSlaHours: {
            type: Number,
            enum: [6, 12, 24, 48],
            default: 12
        },
        /**
         * Payroll calculation settings.
         * calculationMode:
         *   'work_hours' — current behaviour: credit = hoursWorked / 8 (fractional)
         *   'day_based'  — credit based on punch-in+out presence vs hour thresholds
         */
        payrollSettings: {
            calculationMode: {
                type: String,
                enum: ['work_hours', 'day_based'],
                default: 'work_hours'
            },
            // Only used when calculationMode === 'day_based'
            minHoursForFullDay: {
                type: Number,
                default: 8,
                min: 0
            },
            minHoursForHalfDay: {
                type: Number,
                default: 4,
                min: 0
            },
            /**
             * Day-based only: if employee clocks in after office start + check-in grace,
             * attendance is half-day and payroll credit is capped at 0.5.
             */
            markHalfDayIfLate: {
                type: Boolean,
                default: false
            }
        },
        /**
         * Resume Inbox — inbound recruitment mailbox (IMAP).
         * Password is stored encrypted; never returned by APIs in plaintext.
         */
        resumeInbox: {
            enabled: { type: Boolean, default: false },
            provider: {
                type: String,
                enum: ['gmail', 'outlook', 'imap', ''],
                default: '',
            },
            host: { type: String, trim: true, default: '' },
            port: { type: Number, default: 993 },
            secure: { type: Boolean, default: true },
            user: { type: String, trim: true, lowercase: true, default: '' },
            /** AES-encrypted mailbox password — strip before API responses */
            passwordEncrypted: { type: String, default: '' },
            folder: { type: String, trim: true, default: 'INBOX' },
            lastPolledAt: { type: Date, default: null },
            lastPollError: { type: String, default: null },
        },
        /**
         * Automatic Resume Screening (org-wide defaults).
         * Job-level screeningCriteria still applies per posting.
         */
        resumeScreening: {
            enabled: { type: Boolean, default: true },
            defaultMinimumMatchPercent: { type: Number, default: 70, min: 0, max: 100 },
            retentionDays: { type: Number, default: 7, min: 1, max: 365 },
            requiredKeywordWeight: { type: Number, default: 1, min: 0 },
            optionalKeywordWeight: { type: Number, default: 0.5, min: 0 },
            autoDeleteEnabled: { type: Boolean, default: true },
            /** Lifetime count of auto-deleted failed-screening candidates */
            autoDeletedCount: { type: Number, default: 0 },
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

